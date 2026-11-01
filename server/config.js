'use strict';

function loadConfig(env = process.env) {
  const port = Number(env.PORT || 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT 无效');
  const production = env.NODE_ENV === 'production';
  const url = new URL(env.PUBLIC_ORIGIN || `http://localhost:${port}`);
  if (!['http:', 'https:'].includes(url.protocol) || url.pathname !== '/' || url.search || url.hash || url.username || url.password) throw new Error('PUBLIC_ORIGIN 必须是站点源地址');
  if (production && url.protocol !== 'https:') throw new Error('生产站点必须使用 HTTPS');
  return { port, host: env.HOST || '127.0.0.1', production, origin: url.origin };
}
module.exports = { loadConfig };
