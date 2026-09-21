import { timingSafeEqual } from 'node:crypto';
import { GameError, GameStore } from '../game.js';
import { seedQuestions } from '../seed.js';
import { RedisRoomRepository } from '../redis-room-repository.js';

function reply(res, status, value) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff'
  });
  res.end(JSON.stringify(value));
}

function checkPassword(actual, expected) {
  const a = Buffer.from(String(actual ?? ''), 'utf8');
  const b = Buffer.from(expected, 'utf8');
  return a.length === b.length && timingSafeEqual(a, b);
}

async function requestBody(req) {
  if (req.body !== undefined) {
    if (req.body && typeof req.body === 'object' && !Array.isArray(req.body)) return req.body;
    if (typeof req.body === 'string') {
      try {
        const value = JSON.parse(req.body);
        if (value && typeof value === 'object' && !Array.isArray(value)) return value;
      } catch {}
    }
    throw new GameError('Dữ liệu gửi không hợp lệ.');
  }
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 150000) throw new GameError('Dữ liệu gửi quá lớn.', 413);
    chunks.push(chunk);
  }
  if (!size) return {};
  try {
    const value = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (value && typeof value === 'object' && !Array.isArray(value)) return value;
  } catch {}
  throw new GameError('Dữ liệu gửi không hợp lệ.');
}

function secret(req) {
  const value = req.headers.authorization || '';
  return value.startsWith('Bearer ') ? value.slice(7) : '';
}

// Every attempt starts from current Redis state. A conflicting request reloads
// the room before replaying its action, avoiding duplicate points and lost joins.
export function createVercelHandler({ repository = new RedisRoomRepository(), hostPassword = process.env.HOST_PASSWORD, storeFactory = () => new GameStore({ questions: seedQuestions }) } = {}) {
  if (!hostPassword?.trim()) throw new Error('Thiếu biến môi trường HOST_PASSWORD trên Vercel.');

  return async function handler(req, res) {
    try {
      const url = new URL(req.url, 'https://game.invalid');
      const path = url.searchParams.get('path') || url.pathname.replace(/^\/api\/?/, '');
      if (req.method === 'GET' && path === 'info') return reply(res, 200, { lanUrls: [] });
      if (req.method === 'POST' && path === 'rooms') {
        const { password, ...options } = await requestBody(req);
        if (!checkPassword(password, hostPassword)) throw new GameError('Mật khẩu người dẫn không đúng.', 403);
        for (let attempt = 0; attempt < 12; attempt++) {
          const store = storeFactory();
          const result = store.create(options);
          if (await repository.create(store.rooms.get(result.code))) return reply(res, 201, result);
        }
        throw new GameError('Chưa tạo được mã phòng. Vui lòng thử lại.', 503);
      }
      const match = path.match(/^rooms\/(\d{6})\/(join|state|leave|config|next|spin|spin-missing|prepare|prepare-missing|begin|answer)$/);
      if (!match) return reply(res, 404, { error: 'Không tìm thấy trang.' });
      const [, code, action] = match;
      if ((req.method === 'GET' && action !== 'state') || (req.method === 'POST' && action === 'state') || !['GET', 'POST'].includes(req.method)) {
        return reply(res, 405, { error: 'Phương thức không hợp lệ.' });
      }
      const payload = req.method === 'POST' && ['join', 'config', 'prepare', 'answer'].includes(action) ? await requestBody(req) : {};
      for (let attempt = 0; attempt < 8; attempt++) {
        const { raw, room } = await repository.load(code);
        const store = storeFactory();
        store.rooms.set(code, room);
        let result = {};
        if (action === 'join') result = store.join(code, payload.name);
        else {
          const auth = store.auth(code, secret(req));
          if (action === 'state') result = store.state(auth);
          else if (action === 'leave') store.leave(auth);
          else if (action === 'config') store.configure(auth, payload);
          else if (action === 'next') store.next(auth);
          else if (action === 'spin') result = store.spin(auth);
          else if (action === 'spin-missing') store.spinMissing(auth);
          else if (action === 'prepare') result = store.prepare(auth, payload);
          else if (action === 'prepare-missing') store.prepareMissing(auth);
          else if (action === 'begin') store.begin(auth);
          else if (action === 'answer') result = store.submit(auth, payload.answer);
        }
        const updated = store.rooms.get(code);
        if (JSON.stringify(updated) === raw || await repository.save(code, raw, updated)) {
          return reply(res, action === 'join' ? 201 : 200, result);
        }
      }
      throw new GameError('Có nhiều thao tác cùng lúc. Vui lòng thử lại.', 409);
    } catch (error) {
      if (!(error instanceof GameError)) console.error(error);
      return reply(res, error instanceof GameError ? error.status : 500, {
        error: error instanceof GameError ? error.message : 'Có lỗi máy chủ. Vui lòng thử lại.'
      });
    }
  };
}

export default async function handler(req, res) {
  try { return await createVercelHandler()(req, res); }
  catch (error) {
    console.error(error);
    return reply(res, 503, { error: 'Máy chủ chưa được cấu hình. Kiểm tra Redis và mật khẩu người dẫn.' });
  }
}
