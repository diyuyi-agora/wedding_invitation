'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadConfig } = require('../config');
const { createApp } = require('../app');

test('server configuration only needs invitation settings', () => {
  assert.deepEqual(loadConfig({}), { port: 3000, host: '127.0.0.1', production: false, origin: 'http://localhost:3000' });
  assert.equal(loadConfig({ PORT: '4175' }).origin, 'http://localhost:4175');
  assert.equal(loadConfig({ NODE_ENV: 'production', PUBLIC_ORIGIN: 'https://island.example' }).production, true);
  for (const env of [{ PORT: '-1' }, { PORT: '1.5' }, { PUBLIC_ORIGIN: 'https://island.example/path' }, { NODE_ENV: 'production' }]) assert.throws(() => loadConfig(env));
});

test('invitation runs without payment services and retired routes are unavailable', async t => {
  const server = createApp().listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const origin = `http://127.0.0.1:${server.address().port}`;
  assert.deepEqual(await (await fetch(origin + '/health')).json(), { ok: true });
  const html = await (await fetch(origin)).text();
  assert.ok(html.includes('id="rsvp-form"'));
  assert.ok(html.includes('class="blessing-stream home-stream"'));
  assert.doesNotMatch(html, /donation-form|payment-button|支付宝|收银台/);
  for (const file of ['/app.js', '/game.css', '/婚礼邀请函.html']) {
    const response = await fetch(origin + file);
    assert.equal(response.status, 200);
    assert.doesNotMatch(await response.text(), /donation-panel|donation-form|payment-button|\/api\/payment|支付宝|收银台/);
  }
  const retired = ['/payment', '/payment/return', '/payment/orders/old', '/payment.css', '/api/payment-session', '/api/payments', '/api/payments/old', '/api/payments/old/close', '/api/payments/old/refunds', '/api/payments/old/refunds/old', '/api/alipay/notify'];
  for (const method of ['GET', 'POST']) for (const path of retired) {
    const response = await fetch(origin + path, { method });
    assert.equal(response.status, 404, `${method} ${path}`);
    assert.equal(response.headers.has('set-cookie'), false);
  }
  for (const path of ['/server/.env', '/server/.alipay-sandbox.json', '/server/data/payments.sqlite', '/server/app.js', '/node_modules/express/package.json', '/assets/%2e%2e%2fserver%2fanalytics.js']) assert.equal((await fetch(origin + path)).status, 404, path);
  const asset = await fetch(origin + '/assets/leaf.svg');
  assert.equal(asset.status, 200);
  assert.match(asset.headers.get('cache-control'), /max-age=86400/);
  const code = await fetch(origin + '/app.js');
  assert.match(code.headers.get('cache-control'), /max-age=0/);
  assert.equal((await fetch(origin + '/api/stats')).status, 503);
});
