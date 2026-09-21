import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import os from 'node:os';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { GameStore, GameError } from './game.js';
import { seedQuestions } from './seed.js';

const root = path.dirname(fileURLToPath(import.meta.url));
const localPasswordFile = path.join(root, '.host-password');
const staticFiles = { '/': ['index.html', 'text/html; charset=utf-8'], '/join': ['index.html', 'text/html; charset=utf-8'], '/app.js': ['app.js', 'text/javascript; charset=utf-8'], '/style.css': ['style.css', 'text/css; charset=utf-8'] };

function json(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  res.end(JSON.stringify(data));
}

async function body(req) {
  const chunks = [];
  let bytes = 0;
  for await (const chunk of req) {
    bytes += chunk.length;
    if (bytes > 150000) throw new GameError('Dữ liệu gửi quá lớn.', 413);
    chunks.push(chunk);
  }
  const value = Buffer.concat(chunks).toString('utf8');
  if (!value) return {};
  let parsed;
  try { parsed = JSON.parse(value); } catch { throw new GameError('Dữ liệu gửi không hợp lệ.'); }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new GameError('Dữ liệu gửi không hợp lệ.');
  return parsed;
}

function authToken(req) {
  const value = req.headers.authorization || '';
  return value.startsWith('Bearer ') ? value.slice(7) : '';
}

function passwordMatches(value, expected) {
  const actual = Buffer.from(String(value ?? ''), 'utf8');
  const wanted = Buffer.from(String(expected), 'utf8');
  return actual.length === wanted.length && timingSafeEqual(actual, wanted);
}

function hostPasswordForLocalRun() {
  const configured = process.env.HOST_PASSWORD?.trim();
  if (configured) return configured;
  if (process.env.VERCEL) {
    throw new Error('Thiếu biến môi trường HOST_PASSWORD trên Vercel.');
  }
  try {
    const saved = readFileSync(localPasswordFile, 'utf8').trim();
    if (saved) return saved;
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  const generated = randomBytes(18).toString('base64url');
  try {
    writeFileSync(localPasswordFile, `${generated}\n`, { encoding: 'utf8', flag: 'wx', mode: 0o600 });
    return generated;
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
    return readFileSync(localPasswordFile, 'utf8').trim();
  }
}

function lanAddresses(port) {
  const addresses = [];
  for (const entries of Object.values(os.networkInterfaces())) for (const entry of entries || []) {
    if (entry.family === 'IPv4' && !entry.internal && !entry.address.startsWith('169.254.')) addresses.push(`http://${entry.address}:${port}`);
  }
  const preference = url => {
    const address = new URL(url).hostname;
    if (address.startsWith('192.168.')) return 0;
    if (address.startsWith('10.')) return 1;
    if (/^172\.(1[6-9]|2\d|3[01])\./.test(address)) return 2;
    return 3;
  };
  return [...new Set(addresses)].sort((a, b) => preference(a) - preference(b));
}

export function createAppServer({ store = new GameStore({ questions: seedQuestions }), port = Number(process.env.PORT || 3000), hostPassword = process.env.HOST_PASSWORD } = {}) {
  if (!hostPassword?.trim()) throw new Error('HOST_PASSWORD chưa được cấu hình.');
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
      if (req.method === 'GET' && staticFiles[url.pathname]) {
        const [name, type] = staticFiles[url.pathname];
        const content = await readFile(path.join(root, name));
        res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; object-src 'none'" });
        res.end(content); return;
      }
      if (req.method === 'GET' && url.pathname === '/api/info') return json(res, 200, { lanUrls: lanAddresses(server.address()?.port || port) });
      if (req.method === 'POST' && url.pathname === '/api/rooms') {
        const { password, ...options } = await body(req);
        if (!passwordMatches(password, hostPassword)) throw new GameError('Mật khẩu người dẫn không đúng.', 403);
        return json(res, 201, store.create(options));
      }
      const match = url.pathname.match(/^\/api\/rooms\/(\d{6})(?:\/(join|state|leave|config|next|spin|spin-missing|prepare|prepare-missing|begin|answer))?$/);
      if (!match) return json(res, 404, { error: 'Không tìm thấy trang.' });
      const [, code, action] = match;
      if (req.method === 'POST' && action === 'join') return json(res, 201, store.join(code, (await body(req)).name));
      const auth = store.auth(code, authToken(req));
      if (req.method === 'GET' && action === 'state') return json(res, 200, store.state(auth));
      if (req.method !== 'POST') return json(res, 405, { error: 'Phương thức không hợp lệ.' });
      let result = {};
      if (action === 'leave') store.leave(auth);
      else if (action === 'config') store.configure(auth, await body(req));
      else if (action === 'next') store.next(auth);
      else if (action === 'spin') result = store.spin(auth);
      else if (action === 'spin-missing') store.spinMissing(auth);
      else if (action === 'prepare') result = store.prepare(auth, await body(req));
      else if (action === 'prepare-missing') store.prepareMissing(auth);
      else if (action === 'begin') store.begin(auth);
      else if (action === 'answer') result = store.submit(auth, (await body(req)).answer);
      else return json(res, 404, { error: 'Không tìm thấy thao tác.' });
      return json(res, 200, result);
    } catch (error) {
      if (!(error instanceof GameError)) console.error(error);
      json(res, error instanceof GameError ? error.status : 500, { error: error instanceof GameError ? error.message : 'Có lỗi máy chủ. Vui lòng thử lại.' });
    }
  });
  return server;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 3000);
  const hostPassword = hostPasswordForLocalRun();
  const server = createAppServer({ port, hostPassword });
  server.on('error', error => {
    if (error.code === 'EADDRINUSE') {
      console.error(`Không thể khởi động: cổng ${port} đang được một chương trình khác sử dụng.`);
      console.error('Hãy dừng cửa sổ server cũ bằng Ctrl+C rồi chạy lại npm start.');
      process.exitCode = 1;
      return;
    }
    throw error;
  });
  server.listen(port, '0.0.0.0', () => {
    console.log(`Dấu ấn Hồ Chí Minh đang chạy tại http://localhost:${port}`);
    console.log(`Mật khẩu người dẫn: ${hostPassword}`);
    for (const address of lanAddresses(port)) console.log(`Thiết bị cùng Wi-Fi: ${address}`);
  });
}
