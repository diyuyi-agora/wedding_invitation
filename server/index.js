'use strict';
process.umask(0o077);
const fs = require('node:fs');
const path = require('node:path');
const { loadConfig } = require('./config');
const { createAnalytics } = require('./analytics');
const { createApp } = require('./app');

try {
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) process.loadEnvFile(envPath);
  const config = loadConfig();
  const app = createApp({ config, analytics: createAnalytics() });
  const server = app.listen(config.port, config.host, () => {
    console.log(`Wedding invitation service ready, port ${config.port}`);
  });
  server.on('error', () => { console.error('Invitation service cannot bind the configured port'); process.exitCode = 1; });
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => process.exit(0)));
} catch { console.error('Invitation service configuration failed; check the server and Redis environment settings'); process.exitCode = 1; }
