'use strict';
const express = require('express');
const path = require('node:path');
const { mountAnalytics } = require('./analytics');

function page(title, message) {
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} · 幸福小岛</title></head><body><main><h1>${title}</h1><p>${message}</p><a href="/">返回婚礼邀请函</a></main></body></html>`;
}
function createApp({ config = {}, analytics = null } = {}) {
  const app = express();
  app.disable('x-powered-by');
  // The container port is bound to localhost and reached through the local reverse proxy.
  app.set('trust proxy', 1);
  app.use((req, res, next) => {
    res.set({ 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'X-Frame-Options': 'DENY' });
    if (req.path.startsWith('/api/') || req.path === '/health') res.set('Cache-Control', 'no-store');
    next();
  });
  app.use(express.json({ limit: '16kb' }));
  mountAnalytics(app, { analytics, production: config.production, origin: config.origin });
  app.get('/health', (req, res) => res.json({ ok: true }));
  app.get('/favicon.ico', (req, res) => res.status(204).end());
  // Keep private configuration, local data and dependencies outside the public allowlist.
  const publicRoot = path.resolve(__dirname, '..');
  const allowed = new Set(['/', '/index.html', '/config.js', '/app.js', '/game.css', '/reference-ui.css', '/婚礼邀请函.html', '/REFERENCE-LICENSE.txt', '/FONT-LICENSES.txt', '/ROUND-FONT-LICENSE.txt', '/资源来源.md']);
  app.use((req, res, next) => {
    if (!['GET', 'HEAD'].includes(req.method)) return next();
    let pathname; try { pathname = decodeURIComponent(req.path); } catch { return next(); }
    const asset = pathname.startsWith('/assets/');
    if (!allowed.has(pathname) && !asset) return next();
    const file = asset ? pathname.slice('/assets/'.length) : pathname === '/' ? 'index.html' : pathname.slice(1);
    return res.sendFile(file, { root: asset ? path.join(publicRoot, 'assets') : publicRoot, dotfiles: 'deny', maxAge: asset ? '1d' : 0 }, error => { if (error) next(); });
  });
  app.use((req, res) => {
    if (req.path.startsWith('/api/')) return res.status(404).json({ error: '接口不存在' });
    res.status(404).type('html').send(page('页面未找到', '请返回婚礼邀请函继续。'));
  });
  app.use((error, req, res, next) => {
    const status = error.status >= 400 && error.status < 600 ? error.status : 500;
    const message = status < 500 ? '请求格式不正确，请检查后重试。' : '服务暂时不可用，请稍后重试。';
    if (req.path.startsWith('/api/')) return res.status(status).json({ error: message });
    res.status(status).type('html').send(page('暂时无法处理', message));
  });
  return app;
}
module.exports = { createApp };
