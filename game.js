import { randomBytes, randomInt } from 'node:crypto';

export const ITEM = Object.freeze({
  shield: { name: 'Khiên', icon: '◈', description: 'Chặn một đòn Màn sương.' },
  hint: { name: 'Gợi ý', icon: '✦', description: 'Hé thêm 2 chữ chỉ cho nhóm bạn.' },
  bonus: { name: 'Cộng điểm', icon: '✚', description: 'Thêm 200 điểm nếu trả lời đúng.' },
  fog: { name: 'Màn sương', icon: '◌', description: 'Che ô chữ của một đối thủ trong 3 giây.' }
});

export class GameError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}

export function normalizeAnswer(value) {
  return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
}

export function scoreFor(elapsedMs, durationSec) {
  return Math.max(100, 1000 - Math.floor(900 * Math.max(0, elapsedMs) / (durationSec * 1000)));
}

function token() { return randomBytes(24).toString('base64url'); }
function cleanText(value, max) { return String(value ?? '').trim().slice(0, max); }
function validQuestions(questions) {
  if (!Array.isArray(questions) || questions.length < 1 || questions.length > 30) throw new GameError('Cần từ 1 đến 30 câu hỏi.');
  return questions.map((q, index) => {
    if (!q || typeof q !== 'object' || Array.isArray(q)) throw new GameError(`Câu ${index + 1} không hợp lệ.`);
    const prompt = cleanText(q.prompt, 400);
    const answer = cleanText(q.answer, 80).normalize('NFC');
    const explanation = cleanText(q.explanation, 700);
    const source = cleanText(q.source, 400);
    const aliases = Array.isArray(q.aliases) ? q.aliases.map(a => cleanText(a, 80)).filter(Boolean).slice(0, 8) : [];
    if (!prompt || !answer || !normalizeAnswer(answer)) throw new GameError(`Câu ${index + 1} cần đề bài và đáp án hợp lệ.`);
    if (Array.from(answer).filter(ch => /\p{L}|\p{N}/u.test(ch)).length > 65) throw new GameError(`Đáp án câu ${index + 1} quá dài.`);
    return { prompt, answer, explanation, source, aliases };
  });
}

export class GameStore {
  constructor({ questions, now = () => Date.now(), chooseItem = () => Object.keys(ITEM)[randomInt(4)] } = {}) {
    this.rooms = new Map();
    this.seed = validQuestions(questions ?? [{ prompt: 'Câu hỏi mẫu', answer: 'Đáp án', explanation: '', source: '', aliases: [] }]);
    this.now = now;
    this.chooseItem = chooseItem;
  }

  create({ durationSec = 30 } = {}) {
    durationSec = Number(durationSec);
    if (!Number.isInteger(durationSec) || durationSec < 10 || durationSec > 90) throw new GameError('Thời gian mỗi câu phải từ 10 đến 90 giây.');
    let code;
    do { code = String(randomInt(100000, 1000000)); } while (this.rooms.has(code));
    const hostToken = token();
    const room = { code, hostToken, phase: 'lobby', durationSec, questions: structuredClone(this.seed), index: -1, players: [], startedAt: null, endedAt: null, createdAt: this.now(), version: 1 };
    this.rooms.set(code, room);
    return { code, token: hostToken };
  }

  room(code) {
    const room = this.rooms.get(String(code));
    if (!room) throw new GameError('Không tìm thấy phòng. Kiểm tra lại mã phòng.', 404);
    this.advanceIfDue(room);
    return room;
  }

  auth(code, secret) {
    const room = this.room(code);
    if (!secret) throw new GameError('Thiếu quyền truy cập phòng.', 401);
    if (secret === room.hostToken) return { room, role: 'host', player: null };
    const player = room.players.find(p => p.token === secret);
    if (!player) throw new GameError('Phiên tham gia không hợp lệ. Hãy vào lại phòng.', 401);
    return { room, role: 'player', player };
  }

  join(code, name) {
    const room = this.room(code);
    if (room.phase !== 'lobby') throw new GameError('Trận đã bắt đầu. Không thể thêm nhóm mới.');
    name = cleanText(name, 28).replace(/\s+/g, ' ');
    if (name.length < 2) throw new GameError('Tên nhóm cần ít nhất 2 ký tự.');
    if (room.players.some(p => p.name.toLocaleLowerCase('vi') === name.toLocaleLowerCase('vi'))) throw new GameError('Tên nhóm đã được dùng trong phòng.');
    if (room.players.length >= 20) throw new GameError('Phòng đã đủ 20 nhóm.');
    const player = { id: randomBytes(8).toString('hex'), token: token(), name, score: 0, inventory: [], spins: 0, prepared: false, selectedItem: null, selectedTargetId: null, bonusReady: false, shieldReady: false, fogUntil: 0, hintIndexes: [], solvedAt: null, roundPoints: 0, wrongUntil: 0, feedback: null };
    room.players.push(player); room.version++;
    return { code: room.code, token: player.token };
  }

  leave(auth) {
    this.requirePlayer(auth);
    const r = auth.room;
    const index = r.players.indexOf(auth.player);
    if (index < 0) throw new GameError('Nhóm không còn ở trong phòng.', 404);
    r.players.splice(index, 1);
    if (r.phase === 'question' && r.players.length > 0 && r.players.every(p => p.solvedAt !== null)) this.reveal(r);
    else r.version++;
  }

  requireHost(auth) { if (auth.role !== 'host') throw new GameError('Chỉ người dẫn mới thực hiện được thao tác này.', 403); }
  requirePlayer(auth) { if (auth.role !== 'player') throw new GameError('Thao tác này chỉ dành cho nhóm chơi.', 403); }

  configure(auth, { durationSec, questions }) {
    this.requireHost(auth);
    const r = auth.room;
    if (r.phase !== 'lobby') throw new GameError('Chỉ chỉnh sửa được trước khi bắt đầu.');
    if (durationSec !== undefined) {
      const n = Number(durationSec);
      if (!Number.isInteger(n) || n < 10 || n > 90) throw new GameError('Thời gian mỗi câu phải từ 10 đến 90 giây.');
      r.durationSec = n;
    }
    if (questions !== undefined) r.questions = validQuestions(questions);
    r.version++;
  }

  next(auth) {
    this.requireHost(auth);
    const r = auth.room;
    if (r.phase === 'lobby') {
      if (r.players.length < 1) throw new GameError('Cần ít nhất một nhóm tham gia.');
      r.phase = 'wheel'; r.version++; return;
    }
    if (r.phase !== 'reveal') throw new GameError('Chưa thể chuyển câu lúc này.');
    if (r.index + 1 >= r.questions.length) { r.phase = 'final'; r.version++; return; }
    this.prepareRound(r);
  }

  prepareRound(r) {
    r.index++;
    r.phase = 'prepare'; r.startedAt = null; r.endedAt = null;
    for (const p of r.players) Object.assign(p, { prepared: false, selectedItem: null, selectedTargetId: null, bonusReady: false, shieldReady: false, fogUntil: 0, hintIndexes: [], solvedAt: null, roundPoints: 0, wrongUntil: 0, feedback: null });
    r.version++;
  }

  spin(auth) {
    this.requirePlayer(auth);
    const { room: r, player: p } = auth;
    if (r.phase !== 'wheel') throw new GameError('Chưa đến lượt quay.');
    if (p.spins >= 5) throw new GameError('Nhóm đã quay đủ 5 lượt.');
    const item = this.chooseItem();
    if (!ITEM[item]) throw new Error('Invalid item generator');
    p.inventory.push(item); p.spins++; r.version++;
    return { item, spins: p.spins };
  }

  spinMissing(auth) {
    this.requireHost(auth);
    const r = auth.room;
    if (r.phase !== 'wheel') throw new GameError('Chỉ quay hộ trong giai đoạn vòng quay.');
    for (const p of r.players) while (p.spins < 5) {
      const item = this.chooseItem();
      if (!ITEM[item]) throw new Error('Invalid item generator');
      p.inventory.push(item); p.spins++;
    }
    r.version++;
  }

  prepare(auth, { item = null, targetId = null } = {}) {
    this.requirePlayer(auth);
    const { room: r, player: p } = auth;
    if (r.phase !== 'prepare') throw new GameError('Chưa đến lúc chọn chức năng.');
    if (p.prepared) throw new GameError('Nhóm đã chốt lựa chọn cho câu này.');
    if (item !== null) {
      if (!ITEM[item]) throw new GameError('Chức năng không hợp lệ.');
      const inventoryIndex = p.inventory.indexOf(item);
      if (inventoryIndex < 0) throw new GameError('Chức năng này không còn trong kho.');
      if (item === 'fog') {
        const target = r.players.find(x => x.id === targetId);
        if (!target || target === p) throw new GameError('Hãy chọn một nhóm đối thủ.');
      }
      p.inventory.splice(inventoryIndex, 1);
      p.selectedItem = item;
      p.selectedTargetId = item === 'fog' ? targetId : null;
    }
    p.prepared = true;
    p.feedback = { kind: 'info', text: item ? `Đã chọn chức năng ${ITEM[item].name} cho câu này.` : 'Nhóm sẽ không dùng chức năng ở câu này.' };
    r.version++;
    return { selectedItem: p.selectedItem };
  }

  prepareMissing(auth) {
    this.requireHost(auth);
    const r = auth.room;
    if (r.phase !== 'prepare') throw new GameError('Chỉ có thể bỏ qua hộ trong giai đoạn chuẩn bị.');
    for (const p of r.players) if (!p.prepared) {
      p.prepared = true;
      p.feedback = { kind: 'info', text: 'Người dẫn đã chọn bỏ qua chức năng cho câu này.' };
    }
    r.version++;
  }

  begin(auth) {
    this.requireHost(auth);
    const r = auth.room;
    if (r.phase === 'wheel') {
      if (r.players.some(p => p.spins < 5)) throw new GameError('Hãy đợi tất cả nhóm quay đủ 5 lượt.');
      this.prepareRound(r);
      return;
    }
    if (r.phase !== 'prepare') throw new GameError('Chưa đến lúc bắt đầu câu.');
    if (r.players.some(p => !p.prepared)) throw new GameError('Hãy đợi tất cả nhóm chọn chức năng hoặc bỏ qua.');
    r.phase = 'question'; r.startedAt = this.now();
    this.activatePerks(r);
    r.version++;
  }

  activatePerks(r) {
    const q = r.questions[r.index];
    for (const p of r.players) {
      if (p.selectedItem === 'bonus') p.bonusReady = true;
      if (p.selectedItem === 'shield') p.shieldReady = true;
      if (p.selectedItem === 'hint') {
        p.hintIndexes = Array.from(q.answer.normalize('NFC')).map((c, i) => /\p{L}|\p{N}/u.test(c) ? i : -1).filter(i => i >= 0).slice(0, 2);
      }
    }
    for (const p of r.players) if (p.selectedItem === 'fog') {
      const target = r.players.find(x => x.id === p.selectedTargetId);
      if (!target) continue;
      if (target.shieldReady) {
        target.shieldReady = false;
        p.feedback = { kind: 'info', text: `Khiên của ${target.name} đã chặn Màn sương.` };
        target.feedback = { kind: 'info', text: `Khiên đã chặn Màn sương từ ${p.name}.` };
      } else {
        target.fogUntil = Math.max(target.fogUntil, r.startedAt + 3000);
        p.feedback = { kind: 'info', text: `Đã che ô chữ của ${target.name} trong 3 giây.` };
      }
    }
  }

  advanceIfDue(r) {
    if (r.phase === 'question' && this.now() >= r.startedAt + r.durationSec * 1000) this.reveal(r);
  }

  reveal(r) { r.phase = 'reveal'; r.endedAt = this.now(); r.version++; }

  submit(auth, answer) {
    this.requirePlayer(auth);
    const { room: r, player: p } = auth;
    this.advanceIfDue(r);
    if (r.phase !== 'question') throw new GameError('Câu hỏi đã đóng.');
    if (p.solvedAt !== null) throw new GameError('Nhóm đã trả lời đúng câu này.');
    const now = this.now();
    if (now < p.wrongUntil) throw new GameError('Vui lòng đợi một chút trước khi thử lại.');
    const response = normalizeAnswer(answer);
    if (!response) throw new GameError('Hãy nhập đáp án.');
    const q = r.questions[r.index];
    const accepted = [q.answer, ...q.aliases].some(a => normalizeAnswer(a) === response);
    if (accepted) {
      p.solvedAt = now;
      p.roundPoints = scoreFor(now - r.startedAt, r.durationSec) + (p.bonusReady ? 200 : 0);
      p.score += p.roundPoints;
      p.feedback = { kind: 'correct', text: `Chính xác! +${p.roundPoints} điểm` };
      if (r.players.every(x => x.solvedAt !== null)) this.reveal(r);
    } else {
      p.wrongUntil = now + 2000;
      p.feedback = { kind: 'wrong', text: 'Chưa đúng. Thử lại sau 2 giây.' };
    }
    r.version++;
    return { correct: accepted, feedback: p.feedback };
  }

  state(auth) {
    const { room: r, role, player } = auth;
    this.advanceIfDue(r);
    const q = r.index >= 0 ? r.questions[r.index] : null;
    const sorted = [...r.players].sort((a, b) => b.score - a.score || r.players.indexOf(a) - r.players.indexOf(b));
    let rank = 0, lastScore = null;
    const players = sorted.map((p, i) => {
      if (p.score !== lastScore) rank = i + 1;
      lastScore = p.score;
      return { id: p.id, name: p.name, score: p.score, rank, spun: p.spins >= 5, spinCount: p.spins, prepared: p.prepared, solved: p.solvedAt !== null, roundPoints: r.phase === 'question' && role !== 'host' && p !== player ? null : p.roundPoints };
    });
    const state = { code: r.code, role, phase: r.phase, durationSec: r.durationSec, questionIndex: r.index, totalQuestions: r.questions.length, version: r.version, serverNow: this.now(), startedAt: r.startedAt, endedAt: r.endedAt, players, itemCatalog: ITEM };
    if (role === 'host') state.questions = r.questions;
    if (player) state.me = { id: player.id, name: player.name, inventory: [...player.inventory], spins: player.spins, prepared: player.prepared, selectedItem: player.selectedItem, bonusReady: player.bonusReady, shieldReady: player.shieldReady, fogUntil: player.fogUntil, solved: player.solvedAt !== null, roundPoints: player.roundPoints, wrongUntil: player.wrongUntil, feedback: player.feedback };
    if (q && (role === 'host' || !['wheel', 'prepare'].includes(r.phase))) {
      const revealed = r.phase === 'question' ? Math.max(0, Math.floor((this.now() - r.startedAt) / 1000)) : ['reveal', 'final'].includes(r.phase) ? Infinity : 0;
      const chars = Array.from(q.answer.normalize('NFC'));
      let count = 0;
      const slots = chars.map((ch, i) => {
        if (!/\p{L}|\p{N}/u.test(ch)) return { text: ch, open: true, separator: true };
        const open = count++ < revealed || (player && player.hintIndexes.includes(i)) || ['reveal', 'final'].includes(r.phase);
        return { text: open ? ch : '', open, separator: false };
      });
      state.question = { prompt: q.prompt, slots };
      if (['reveal', 'final'].includes(r.phase) || role === 'host') Object.assign(state.question, { answer: q.answer, aliases: q.aliases, explanation: q.explanation, source: q.source });
    }
    return state;
  }
}
