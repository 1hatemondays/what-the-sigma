import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createVercelHandler } from '../api/index.js';

class MemoryRepository {
  rooms = new Map();
  async create(room) {
    if (this.rooms.has(room.code)) return false;
    this.rooms.set(room.code, JSON.stringify(room));
    return true;
  }
  async load(code) {
    const raw = this.rooms.get(code);
    if (!raw) return Promise.reject(Object.assign(new Error('not found'), { status: 404 }));
    return { raw, room: JSON.parse(raw) };
  }
  async save(code, original, room) {
    await new Promise(resolve => setTimeout(resolve, 1));
    if (this.rooms.get(code) !== original) return false;
    this.rooms.set(code, JSON.stringify(room));
    return true;
  }
}

test('Vercel handler shares a room between invocations and preserves concurrent joins', async () => {
  const repository = new MemoryRepository();
  const handler = createVercelHandler({ repository, hostPassword: 'secret-password' });
  const server = http.createServer(handler);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = 'http://127.0.0.1:' + server.address().port;
  const request = async (path, { method = 'GET', token, data } = {}) => {
    const response = await fetch(base + '/api/index?path=' + encodeURIComponent(path), {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
      body: data === undefined ? undefined : JSON.stringify(data)
    });
    return { status: response.status, body: await response.json() };
  };
  try {
    const rejected = await request('rooms', { method: 'POST', data: { password: 'wrong' } });
    assert.equal(rejected.status, 403);
    const made = await request('rooms', { method: 'POST', data: { password: 'secret-password' } });
    assert.equal(made.status, 201);
    const { code, token: host } = made.body;
    const [first, second] = await Promise.all([
      request('rooms/' + code + '/join', { method: 'POST', data: { name: 'Nhóm Một' } }),
      request('rooms/' + code + '/join', { method: 'POST', data: { name: 'Nhóm Hai' } })
    ]);
    assert.equal(first.status, 201);
    assert.equal(second.status, 201);
    const state = await request('rooms/' + code + '/state', { token: host });
    assert.equal(state.body.players.length, 2);
    assert.equal(state.status, 200);
    assert.equal((await request('rooms/' + code + '/state')).status, 401);
    assert.equal((await request('info')).body.lanUrls.length, 0);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});
