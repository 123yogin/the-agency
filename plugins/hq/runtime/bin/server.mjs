#!/usr/bin/env node
// Agency HQ server (Node >= 18, no npm dependencies). Normally started by bin/hq.mjs.
// Environment: HQ_PORT, HQ_BIND (default 127.0.0.1), HQ_TOKEN (required), HQ_LAN_KEY + HQ_LAN_URL (LAN mode),
// HQ_CLAUDE_BIN, HQ_MAX_RUNS, HQ_DATA_DIR, HQ_ALLOWED_HOSTS.
import http from 'node:http';

const major = Number(process.versions.node.split('.')[0]);
if (major < 18) {
  console.error(`Agency HQ needs Node 18 or newer (found ${process.versions.node}).`);
  process.exit(1);
}
const { createApp } = await import(new URL('../lib/app.mjs', import.meta.url));

const token = process.env.HQ_TOKEN;
if (!token) {
  console.error('HQ_TOKEN is not set. Start HQ with: node bin/hq.mjs start');
  process.exit(1);
}
const port = Number(process.env.HQ_PORT || 8790);
const bind = process.env.HQ_BIND || '127.0.0.1';
const app = createApp({ token, lanKey: process.env.HQ_LAN_KEY || null, lanUrl: process.env.HQ_LAN_URL || null });
const server = http.createServer(app);
server.on('error', (e) => {
  console.error(`[hq] server failed: ${e.code === 'EADDRINUSE' ? `port ${port} is in use` : e.message}`);
  process.exit(e.code === 'EADDRINUSE' ? 3 : 1);
});
server.listen(port, bind, () => console.log(`Agency HQ listening on http://${bind}:${port}/ (Node ${process.versions.node}, pid ${process.pid})`));
for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    app.lead.shuttingDown = true; // jobs stay "running" on disk, so they come back as interrupted with Retry
    app.dispatcher.stopAll();
    server.close(() => process.exit(0));
    server.closeAllConnections?.();
    setTimeout(() => process.exit(0), 1500).unref();
  });
}
