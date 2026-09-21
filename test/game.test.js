import test from 'node:test';
import assert from 'node:assert/strict';
import { GameStore, GameError, normalizeAnswer, scoreFor } from '../game.js';

const questions = [
  { prompt: 'Tác phẩm nào?', answer: 'Đường Kách mệnh', aliases: ['Đường cách mệnh'], explanation: 'Một tác phẩm.', source: 'https://example.org' },
  { prompt: 'Phẩm chất nào?', answer: 'Chí công vô tư', aliases: [], explanation: 'Một phẩm chất.', source: '' }
];

function fixture(items = ['shield', 'fog', 'hint', 'bonus']) {
  let time = 1_000_000;
  const queue = [...items];
  const store = new GameStore({ questions, now: () => time, chooseItem: () => queue.shift() || 'bonus' });
  const host = store.create({ durationSec: 10 });
  const first = store.join(host.code, 'Sao Vàng');
  const second = store.join(host.code, 'Đoàn Kết');
  return { store, host: store.auth(host.code, host.token), first: store.auth(host.code, first.token), second: store.auth(host.code, second.token), tick(ms) { time += ms; } };
}

function spinFive(store, auth) { for (let i = 0; i < 5; i++) store.spin(auth); }
function reachPreparation(f) {
  f.store.next(f.host);
  spinFive(f.store, f.first);
  spinFive(f.store, f.second);
  f.store.begin(f.host);
}
function beginWithNoPerks(f) {
  reachPreparation(f);
  f.store.prepare(f.first);
  f.store.prepare(f.second);
  f.store.begin(f.host);
}

test('normalization handles accents, đ, punctuation, and excess spaces', () => {
  assert.equal(normalizeAnswer('  ĐƯỜNG   Kách-mệnh! '), 'duong kach menh');
  assert.equal(normalizeAnswer('Chí công vô tư'), 'chi cong vo tu');
  assert.equal(scoreFor(0, 30), 1000);
  assert.equal(scoreFor(15_000, 30), 550);
  assert.equal(scoreFor(30_000, 30), 100);
});

test('player never receives answer or aliases before reveal', () => {
  const f = fixture();
  f.store.next(f.host);
  const wheel = f.store.state(f.first);
  assert.equal(wheel.phase, 'wheel');
  assert.equal(wheel.question, undefined);
  assert.ok(!JSON.stringify(wheel).includes('Đường Kách mệnh'));
  spinFive(f.store, f.first); spinFive(f.store, f.second); f.store.begin(f.host);
  const preparation = f.store.state(f.first);
  assert.equal(preparation.phase, 'prepare');
  assert.equal(preparation.question, undefined);
  assert.ok(!JSON.stringify(preparation).includes('Đường Kách mệnh'));
  f.store.prepare(f.first); f.store.prepare(f.second); f.store.begin(f.host);
  const question = f.store.state(f.first);
  assert.equal(question.question.answer, undefined);
  assert.equal(question.question.aliases, undefined);
  assert.ok(question.question.slots.some(s => !s.open));
  assert.ok(!JSON.stringify(question).includes('Đường Kách mệnh'));
  assert.equal(f.store.state(f.host).question.answer, 'Đường Kách mệnh');
  f.tick(10_000);
  const reveal = f.store.state(f.first);
  assert.equal(reveal.phase, 'reveal');
  assert.equal(reveal.question.answer, 'Đường Kách mệnh');
});

test('host permissions, question validation, and wheel lifecycle', () => {
  const f = fixture();
  assert.throws(() => f.store.next(f.first), /Chỉ người dẫn/);
  assert.throws(() => f.store.configure(f.host, { questions: [null] }), GameError);
  assert.throws(() => f.store.configure(f.host, { durationSec: 9 }), GameError);
  f.store.next(f.host);
  assert.throws(() => f.store.begin(f.host), /đủ 5 lượt/);
  spinFive(f.store, f.first);
  assert.throws(() => f.store.spin(f.first), /đủ 5 lượt/);
  f.store.spinMissing(f.host);
  f.store.begin(f.host);
  assert.equal(f.store.state(f.first).phase, 'prepare');
  assert.throws(() => f.store.begin(f.host), /chọn perk hoặc bỏ qua/);
  f.store.prepare(f.first);
  assert.throws(() => f.store.prepare(f.first), /đã chốt/);
  f.store.prepareMissing(f.host);
  f.store.begin(f.host);
  assert.throws(() => f.store.spin(f.second), /Chưa đến lượt/);
  assert.throws(() => f.store.join(f.host.room.code, 'Nhóm mới'), /đã bắt đầu/);
});

test('wrong answer cooldown, alias match, score once, and timer expiry', () => {
  const f = fixture();
  beginWithNoPerks(f);
  assert.equal(f.store.submit(f.first, 'sai').correct, false);
  assert.throws(() => f.store.submit(f.first, 'duong cach menh'), /đợi/);
  f.tick(2_000);
  assert.equal(f.store.submit(f.first, 'DUONG CACH MENH').correct, true);
  const points = f.store.state(f.first).me.roundPoints;
  assert.equal(points, scoreFor(2_000, 10));
  assert.throws(() => f.store.submit(f.first, 'duong cach menh'), /đã trả lời đúng/);
  assert.equal(f.store.state(f.first).me.roundPoints, points);
  f.tick(8_000);
  assert.equal(f.store.state(f.second).phase, 'reveal');
  assert.throws(() => f.store.submit(f.second, 'Đường Kách mệnh'), /đã đóng/);
  assert.equal(f.store.state(f.second).me.roundPoints, 0);
});

test('items are private, single-use, and shield blocks targeted fog', () => {
  const f = fixture(['shield', 'bonus', 'bonus', 'bonus', 'bonus', 'fog', 'bonus', 'bonus', 'bonus', 'bonus']);
  reachPreparation(f);
  assert.deepEqual(f.store.state(f.first).me.inventory, ['shield', 'bonus', 'bonus', 'bonus', 'bonus']);
  assert.ok(!JSON.stringify(f.store.state(f.second)).includes('"inventory":["shield"'));
  f.store.prepare(f.first, { item: 'shield' });
  f.store.prepare(f.second, { item: 'fog', targetId: f.first.player.id });
  f.store.begin(f.host);
  assert.equal(f.store.state(f.second).players.find(p => p.id === f.first.player.id).roundPoints, null);
  assert.equal(f.store.state(f.first).me.shieldReady, false);
  assert.equal(f.store.state(f.first).me.fogUntil, 0);
  assert.equal(f.store.state(f.first).me.inventory.length, 4);
  assert.equal(f.store.state(f.second).me.inventory.length, 4);
  assert.throws(() => f.store.prepare(f.second, { item: 'bonus' }), /Chưa đến lúc/);
});

test('hint reveals only to owner and bonus adds 200 after correct answer', () => {
  const f = fixture(['hint', 'shield', 'shield', 'shield', 'shield', 'bonus', 'fog', 'fog', 'fog', 'fog']);
  reachPreparation(f);
  f.store.prepare(f.first, { item: 'hint' });
  f.store.prepare(f.second, { item: 'bonus' });
  f.store.begin(f.host);
  const own = f.store.state(f.first).question.slots.filter(s => s.open && !s.separator).length;
  const other = f.store.state(f.second).question.slots.filter(s => s.open && !s.separator).length;
  assert.equal(own - other, 2);
  f.tick(1_000);
  f.store.submit(f.second, 'Đường Kách mệnh');
  assert.equal(f.store.state(f.second).me.roundPoints, scoreFor(1_000, 10) + 200);
});

test('skipping a perk keeps inventory for a later question', () => {
  const f = fixture();
  reachPreparation(f);
  const before = [...f.store.state(f.first).me.inventory];
  f.store.prepare(f.first);
  f.store.prepare(f.second);
  assert.deepEqual(f.store.state(f.first).me.inventory, before);
  f.store.begin(f.host);
  f.tick(10_000);
  assert.equal(f.store.state(f.first).phase, 'reveal');
  f.store.next(f.host);
  assert.equal(f.store.state(f.first).phase, 'prepare');
  assert.deepEqual(f.store.state(f.first).me.inventory, before);
});

test('ties share rank and stable join order', () => {
  const f = fixture();
  const list = f.store.state(f.host).players;
  assert.deepEqual(list.map(p => [p.name, p.rank]), [['Sao Vàng', 1], ['Đoàn Kết', 1]]);
});
