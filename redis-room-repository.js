import { GameError } from './game.js';

const ROOM_TTL_SECONDS = 48 * 60 * 60;
const CAS_SCRIPT = [
  "if redis.call('GET', KEYS[1]) ~= ARGV[1] then return 0 end",
  "redis.call('SET', KEYS[1], ARGV[2], 'EX', ARGV[3])",
  "return 1"
].join('\n');

export class RedisRoomRepository {
  constructor({ url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL, token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN, fetcher = fetch } = {}) {
    if (!url || !token) throw new Error('Thiếu biến kết nối Upstash Redis REST trên Vercel.');
    this.url = url.replace(/\/+$/, '');
    this.token = token;
    this.fetcher = fetcher;
  }

  key(code) { return 'hcm:room:' + code; }

  async command(parts) {
    const response = await this.fetcher(this.url, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + this.token, 'Content-Type': 'application/json' },
      body: JSON.stringify(parts),
      signal: AbortSignal.timeout(8000)
    });
    if (!response.ok) throw new Error('Upstash request failed (' + response.status + ')');
    const data = await response.json();
    if (data.error) throw new Error('Upstash command failed: ' + data.error);
    return data.result;
  }

  async create(room) {
    const result = await this.command(['SET', this.key(room.code), JSON.stringify(room), 'EX', ROOM_TTL_SECONDS, 'NX']);
    return result === 'OK';
  }

  async load(code) {
    const raw = await this.command(['GET', this.key(code)]);
    if (raw === null) throw new GameError('Không tìm thấy phòng. Kiểm tra lại mã phòng.', 404);
    return { raw, room: JSON.parse(raw) };
  }

  async save(code, original, room) {
    const result = await this.command(['EVAL', CAS_SCRIPT, '1', this.key(code), original, JSON.stringify(room), String(ROOM_TTL_SECONDS)]);
    return result === 1;
  }
}

