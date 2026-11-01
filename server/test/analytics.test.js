'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createAnalytics } = require('../analytics');
const { createApp } = require('../app');

test('Redis credentials stay on the server and invalid upstream responses fail closed', async () => {
  const env = { UPSTASH_REDIS_REST_URL: 'https://redis.example', UPSTASH_REDIS_REST_TOKEN: 'secret', WEDDING_REDIS_PREFIX: 'test' };
  let captured;
  const analytics = createAnalytics({ env, fetchImpl: async (url, options) => {
    captured = { url, options };
    return { ok: true, json: async () => ({ result: [7, 3, 2, 1, 1] }) };
  } });
  assert.deepEqual(await analytics.visit('visitor', 'visit-id'), { visits: 7, visitors: 3, blessings: 2, blessed: true, messageSent: true });
  assert.equal(captured.options.headers.Authorization, 'Bearer secret');
  assert.equal(captured.options.redirect, 'error');
  assert.equal(captured.options.body.includes('secret'), false);
  assert.equal(JSON.parse(captured.options.body)[2], 6);
  assert.equal(createAnalytics({ env: {} }), null);
  assert.throws(() => createAnalytics({ env: { ...env, UPSTASH_REDIS_REST_TOKEN: '' } }));
  assert.throws(() => createAnalytics({ env: { ...env, UPSTASH_REDIS_REST_URL: 'http://redis.example' } }));
  const broken = createAnalytics({ env, fetchImpl: async () => ({ ok: true, json: async () => ({ error: 'secret upstream error' }) }) });
  await assert.rejects(broken.read('visitor'), /Redis command failed/);
});

test('analytics API validates requests, maintains private visitor identity and handles outages', async t => {
  const seen = [];
  let fail = false;
  const result = { visits: 1, visitors: 1, blessings: 0, blessed: false, messageSent: false };
  const analytics = {
    async visit(id, visitId) { seen.push({ id, visitId }); return result; },
    async read(id) { if (fail) throw new Error('secret upstream error'); seen.push({ id }); return result; },
    async bless(id, message) { seen.push({ id, message }); return { ...result, blessings: 1, blessed: true, messageSent: Boolean(message) }; },
    async messages() { return [{ name: '小岛朋友', message: '新婚快乐 ♡', createdAt: 1 }]; },
  };
  const server = createApp({ config: { production: false }, analytics }).listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(async () => { await new Promise(resolve => server.close(resolve)); });
  const origin = `http://127.0.0.1:${server.address().port}`;
  const headers = { 'content-type': 'application/json', origin };
  const send = (url, body, extra = {}) => fetch(origin + url, { method: 'POST', headers: { ...headers, ...extra }, body: JSON.stringify(body) });
  assert.equal((await send('/api/visits', { visitId: 'short' })).status, 400);
  assert.equal((await send('/api/blessings', {}, { origin: 'https://other.example' })).status, 403);
  const visit = await send('/api/visits', { visitId: 'test-visit-12345678' });
  assert.equal(visit.status, 200);
  assert.equal(visit.headers.get('cache-control'), 'no-store');
  const cookie = visit.headers.get('set-cookie').split(';')[0];
  assert.match(visit.headers.get('set-cookie'), /HttpOnly; SameSite=Lax/);
  const blessing = await send('/api/blessings', {}, { cookie });
  assert.equal((await blessing.json()).blessed, true);
  assert.equal(seen[0].id, seen[1].id);
  assert.notEqual(seen[0].id, cookie.split('=')[1]);
  assert.equal((await fetch(origin + '/api/stats', { headers: { cookie } })).status, 200);
  assert.deepEqual((await (await fetch(origin + '/api/blessings')).json()).messages, [{ name: '小岛朋友', message: '新婚快乐 ♡', createdAt: 1 }]);
  for (const payload of [{ message: ' ' }, { name: 'a'.repeat(25), message: '祝福' }, { message: 'a'.repeat(161) }, { name: {}, message: '祝福' }]) assert.equal((await send('/api/blessings', payload, { cookie })).status, 400);
  const saved = await send('/api/blessings', { name: '  ', message: ' 新婚快乐 ♡ ' }, { cookie });
  assert.equal((await saved.json()).messageSent, true);
  assert.deepEqual(seen.at(-1).message, { name: '一位岛民', message: '新婚快乐 ♡' });
  fail = true;
  const unavailable = await fetch(origin + '/api/stats');
  assert.equal(unavailable.status, 503);
  assert.equal((await unavailable.text()).includes('secret'), false);
  for (const url of ['/server/.env', '/.env', '/server/analytics.js']) assert.equal((await fetch(origin + url)).status, 404);
});

test('visitor cookies follow the forwarded protocol on the production proxy', async t => {
  const result = { visits: 1, visitors: 1, blessings: 0, blessed: false, messageSent: false };
  const analytics = { async read() { return result; }, async visit() { return result; } };
  const server = createApp({ config: { production: true, origin: 'https://island.example' }, analytics }).listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const https = await fetch(origin + '/api/stats', { headers: { 'x-forwarded-proto': 'https' } });
  assert.match(https.headers.get('set-cookie'), /; Secure;/);
  const http = await fetch(origin + '/api/stats', { headers: { 'x-forwarded-proto': 'http' } });
  assert.doesNotMatch(http.headers.get('set-cookie'), /; Secure;/);
  assert.match(http.headers.get('set-cookie'), /HttpOnly; SameSite=Lax/);
  const cookie = http.headers.get('set-cookie').split(';')[0];
  const visit = await fetch(origin + '/api/visits', { method: 'POST', headers: { origin, cookie, 'x-forwarded-proto': 'http', 'content-type': 'application/json' }, body: JSON.stringify({ visitId: 'proxy-visit-12345678' }) });
  assert.equal(visit.status, 200);
  assert.equal(visit.headers.has('set-cookie'), false);
});
