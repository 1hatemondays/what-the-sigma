import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import { createAppServer } from '../server.js';
import { GameStore } from '../game.js';

test('HTTP flow: create, join two groups, protect state, answer, reconnect', async () => {
  let time = 100_000;
  const store = new GameStore({ questions: [{ prompt: 'Tên khai sinh?', answer: 'Nguyễn Sinh Cung', aliases: [], explanation: 'Tên khai sinh.', source: '' }], now: () => time, chooseItem: () => 'bonus' });
  const server = createAppServer({ store, port: 0, hostPassword: 'test-secret' }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  const request = async (path, method = 'GET', token, data) => {
    const res = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: data === undefined ? undefined : JSON.stringify(data) });
    return { status: res.status, data: await res.json() };
  };
  try {
    assert.equal((await request('/api/rooms', 'POST', null, { password: 'wrong' })).status, 403);
    const created = (await request('/api/rooms', 'POST', null, { password: 'test-secret', durationSec: 10 })).data;
    const prefix = `/api/rooms/${created.code}`;
    const a = (await request(prefix + '/join', 'POST', null, { name: 'Sao Vàng' })).data;
    const b = (await request(prefix + '/join', 'POST', null, { name: 'Đoàn Kết' })).data;
    const leaving = (await request(prefix + '/join', 'POST', null, { name: 'Rời Phòng' })).data;
    assert.equal((await request(prefix + '/leave', 'POST', leaving.token, {})).status, 200);
    assert.deepEqual((await request(prefix + '/state', 'GET', created.token)).data.players.map(p => p.name), ['Sao Vàng', 'Đoàn Kết']);
    assert.equal((await request(prefix + '/state')).status, 401);
    assert.equal((await request(prefix + '/next', 'POST', a.token, {})).status, 403);
    assert.equal((await request(prefix + '/config', 'POST', created.token, { questions: [null] })).status, 400);
    await request(prefix + '/next', 'POST', created.token, {});
    const wheel = (await request(prefix + '/state', 'GET', a.token)).data;
    assert.ok(!JSON.stringify(wheel).includes('Nguyễn Sinh Cung'));
    for (let i = 0; i < 5; i++) {
      await request(prefix + '/spin', 'POST', a.token, {});
      await request(prefix + '/spin', 'POST', b.token, {});
    }
    await request(prefix + '/begin', 'POST', created.token, {});
    const preparation = (await request(prefix + '/state', 'GET', a.token)).data;
    assert.equal(preparation.phase, 'prepare');
    assert.ok(!JSON.stringify(preparation).includes('Nguyễn Sinh Cung'));
    await request(prefix + '/prepare', 'POST', a.token, { item: 'bonus' });
    await request(prefix + '/prepare', 'POST', b.token, {});
    await request(prefix + '/begin', 'POST', created.token, {});
    const inRound = (await request(prefix + '/state', 'GET', a.token)).data;
    assert.ok(!JSON.stringify(inRound).includes('Nguyễn Sinh Cung'));
    time += 1_000;
    const correct = await request(prefix + '/answer', 'POST', a.token, { answer: 'nguyen sinh cung' });
    assert.equal(correct.data.correct, true);
    assert.equal((await request(prefix + '/answer', 'POST', a.token, { answer: 'Nguyễn Sinh Cung' })).status, 400);
    const restored = (await request(prefix + '/state', 'GET', a.token)).data;
    assert.equal(restored.me.roundPoints, 1110);
    time += 9_000;
    const after = (await request(prefix + '/state', 'GET', b.token)).data;
    assert.equal(after.phase, 'reveal');
    assert.equal(after.question.answer, 'Nguyễn Sinh Cung');
    await request(prefix + '/next', 'POST', created.token, {});
    assert.equal((await request(prefix + '/state', 'GET', b.token)).data.phase, 'final');
  } finally { server.close(); await once(server, 'close'); }
});

test('HTTP JSON body handles split UTF-8 bytes and rejects null', async () => {
  const server = createAppServer({ port: 0, hostPassword: 'test-secret' }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const port = server.address().port;
  try {
    const created = await fetch(`http://127.0.0.1:${port}/api/rooms`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: 'test-secret' }) }).then(r => r.json());
    const payload = Buffer.from(JSON.stringify({ name: 'Đội Việt Nam' }));
    const accent = payload.indexOf(0xc4);
    const result = await new Promise((resolve, reject) => {
      const req = http.request({ hostname: '127.0.0.1', port, path: `/api/rooms/${created.code}/join`, method: 'POST', headers: { 'Content-Type': 'application/json' } }, res => {
        let data = ''; res.on('data', chunk => data += chunk); res.on('end', () => resolve({ status: res.statusCode, data: JSON.parse(data) }));
      });
      req.on('error', reject);
      req.write(payload.subarray(0, accent + 1));
      setTimeout(() => { req.end(payload.subarray(accent + 1)); }, 10);
    });
    assert.equal(result.status, 201);
    const invalid = await fetch(`http://127.0.0.1:${port}/api/rooms`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: 'null' });
    assert.equal(invalid.status, 400);
    const joinPage = await fetch(`http://127.0.0.1:${port}/join`);
    assert.equal(joinPage.status, 200);
    const questionImage = await fetch(`http://127.0.0.1:${port}/question-images/baucu.jpg`);
    assert.equal(questionImage.status, 200);
    assert.match(questionImage.headers.get('content-type'), /image\/jpeg/);
  } finally { server.close(); await once(server, 'close'); }
});
