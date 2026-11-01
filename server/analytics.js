'use strict';
const crypto = require('node:crypto');

// All counters and deduplication are updated together, including on concurrent requests.
const WRITE = `
local action, visitor = ARGV[1], ARGV[2]
if action == 'visit' then
  if redis.call('SET', KEYS[4], '1', 'NX', 'EX', 86400) then
    redis.call('HINCRBY', KEYS[1], 'visits', 1)
    redis.call('SADD', KEYS[2], visitor)
    redis.call('HSET', KEYS[1], 'lastVisitAt', ARGV[3])
  end
elseif action == 'blessing' then
  redis.call('SADD', KEYS[3], visitor)
  if ARGV[4] ~= '' and redis.call('SADD', KEYS[6], visitor) == 1 then
    redis.call('LPUSH', KEYS[5], ARGV[4])
    redis.call('LTRIM', KEYS[5], 0, 99)
  end
end
return {tonumber(redis.call('HGET', KEYS[1], 'visits') or '0'), redis.call('SCARD', KEYS[2]), redis.call('SCARD', KEYS[3]), redis.call('SISMEMBER', KEYS[3], visitor), redis.call('SISMEMBER', KEYS[6], visitor)}
`;
const READ = `return {tonumber(redis.call('HGET', KEYS[1], 'visits') or '0'), redis.call('SCARD', KEYS[2]), redis.call('SCARD', KEYS[3]), redis.call('SISMEMBER', KEYS[3], ARGV[1]), redis.call('SISMEMBER', KEYS[4], ARGV[1])}`;

function createAnalytics({ env = process.env, fetchImpl = fetch } = {}) {
  const url = env.UPSTASH_REDIS_REST_URL;
  const token = env.UPSTASH_REDIS_REST_TOKEN;
  if (!url && !token) return null;
  if (!url || !token) throw new Error('Redis environment is incomplete');
  const endpoint = new URL(url);
  if (endpoint.protocol !== 'https:' || endpoint.username || endpoint.password || endpoint.search || endpoint.hash || endpoint.pathname !== '/') throw new Error('Redis REST URL must be an HTTPS origin');
  const prefix = env.WEDDING_REDIS_PREFIX || 'wedding-invitation';
  if (!/^[a-zA-Z0-9:_-]{1,100}$/.test(prefix)) throw new Error('Redis prefix is invalid');
  // A shared hash tag also allows these scripts to run on clustered Redis.
  const base = `{${prefix}}`;
  const keys = [`${base}:stats`, `${base}:visitors`, `${base}:blessings`];
  async function command(args) {
    const response = await fetchImpl(endpoint.href, {
      method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(args), signal: AbortSignal.timeout(5000), redirect: 'error',
    });
    if (!response.ok) throw new Error('Redis request failed');
    const body = await response.json();
    if (body.error) throw new Error('Redis command failed');
    return body.result;
  }
  function stats(values) {
    if (!Array.isArray(values) || values.length !== 5 || values.some(value => !Number.isSafeInteger(value) || value < 0)) throw new Error('Redis response is invalid');
    return { visits: values[0], visitors: values[1], blessings: values[2], blessed: values[3] === 1, messageSent: values[4] === 1 };
  }
  const feed = `${base}:blessing-messages`, authors = `${base}:blessing-authors`;
  return {
    read: async visitor => stats(await command(['EVAL', READ, 4, ...keys, authors, visitor])),
    visit: async (visitor, visitId) => stats(await command(['EVAL', WRITE, 6, ...keys, `${base}:visit:${visitor}:${visitId}`, feed, authors, 'visit', visitor, String(Date.now()), ''])),
    bless: async (visitor, message) => stats(await command(['EVAL', WRITE, 6, ...keys, `${base}:unused`, feed, authors, 'blessing', visitor, String(Date.now()), message ? JSON.stringify({ ...message, createdAt: Date.now() }) : ''])),
    async messages() {
      const values = await command(['LRANGE', feed, 0, 49]);
      if (!Array.isArray(values)) throw new Error('Redis response is invalid');
      return values.map(value => JSON.parse(value)).filter(item => typeof item?.name === 'string' && item.name.length <= 24 && typeof item.message === 'string' && item.message.length <= 160 && Number.isSafeInteger(item.createdAt)).map(({ name, message, createdAt }) => ({ name, message, createdAt }));
    },
  };
}

function mountAnalytics(app, { analytics, production, origin: publicOrigin }) {
  function visitor(req, res) {
    const existing = (req.headers.cookie || '').split(';').map(value => value.trim()).find(value => value.startsWith('wedding_visitor='))?.slice('wedding_visitor='.length);
    const id = /^[a-f0-9]{64}$/.test(existing || '') ? existing : crypto.randomBytes(32).toString('hex');
    if (id !== existing) res.cookie('wedding_visitor', id, { httpOnly: true, sameSite: 'lax', secure: production && req.secure, path: '/', maxAge: 365 * 86400000 });
    return crypto.createHash('sha256').update(id).digest('hex');
  }
  function mutation(req, res, next) {
    const origin = req.headers.origin;
    if (!req.is('application/json') || (origin && origin !== publicOrigin && origin !== `${req.protocol}://${req.get('host')}`) || req.get('sec-fetch-site') === 'cross-site') return res.status(403).json({ error: '请从邀请函页面发起请求' });
    next();
  }
  const route = operation => async (req, res) => {
    if (!analytics) return res.status(503).json({ error: '访问统计暂未配置' });
    try { res.json(await operation(visitor(req, res), req)); }
    catch { res.status(503).json({ error: '访问统计暂时不可用，请稍后重试' }); }
  };
  app.get('/api/stats', route(id => analytics.read(id)));
  app.post('/api/visits', mutation, (req, res, next) => {
    if (typeof req.body?.visitId !== 'string' || !/^[a-zA-Z0-9_-]{16,80}$/.test(req.body.visitId)) return res.status(400).json({ error: '访问编号无效' });
    next();
  }, route((id, req) => analytics.visit(id, req.body.visitId)));
  app.get('/api/blessings', async (req, res) => {
    if (!analytics) return res.status(503).json({ error: '祝福暂未连接' });
    try { res.json({ messages: await analytics.messages() }); }
    catch { res.status(503).json({ error: '暂时读不到小岛祝福，请稍后重试' }); }
  });
  app.post('/api/blessings', mutation, (req, res, next) => {
    const { name, message } = req.body || {};
    if (message !== undefined || name !== undefined) {
      if (typeof message !== 'string' || !message.trim() || message.length > 160 || (name !== undefined && (typeof name !== 'string' || name.length > 24))) return res.status(400).json({ error: '请填写 160 字以内的祝福，昵称最多 24 字' });
      req.blessing = { name: name?.trim() || '一位岛民', message: message.trim() };
    }
    next();
  }, route((id, req) => analytics.bless(id, req.blessing)));
}
module.exports = { createAnalytics, mountAnalytics };
