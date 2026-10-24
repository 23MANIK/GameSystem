#!/usr/bin/env node
/**
 * dev-server.mjs — run the game locally with a working /api/designgame.
 *
 *   node tools/designgame/dev-server.mjs [--port 8020] [--fake]
 *
 * Games and jobs live in memory (lost on restart). The passcode is
 * DESIGNGAME_PASSCODE or "dev". With ANTHROPIC_API_KEY set it uses Claude;
 * with --fake (or no key) a stand-in that "generates" the URL Shortener.
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { handleAction, memoryStore } from './service.mjs';
import { makeFakeClient } from './fake-client.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const args = process.argv.slice(2);
const port = Number(args[args.indexOf('--port') + 1]) || 8020;
const fake = args.includes('--fake') || !process.env.ANTHROPIC_API_KEY;
const env = { ...process.env, DESIGNGAME_PASSCODE: process.env.DESIGNGAME_PASSCODE || 'dev', ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || 'fake' };
const client = fake ? makeFakeClient({ delayMs: 1500, breakFirstPlan: true }) : undefined;
const store = memoryStore();
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };

http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (url.pathname === '/api/designgame') {
    let raw = '';
    for await (const chunk of req) raw += chunk;
    let body = null;
    try { body = raw ? JSON.parse(raw) : null; } catch { /* bad JSON */ }
    try {
      const out = await handleAction(req.method, Object.fromEntries(url.searchParams), body, { store, env, ip: req.socket.remoteAddress, client });
      res.writeHead(out.status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }).end(JSON.stringify(out.body));
    } catch (e) {
      console.error(e);
      res.writeHead(500, { 'Content-Type': 'application/json' }).end(JSON.stringify({ error: e.message }));
    }
    return;
  }
  const file = path.join(ROOT, path.normalize(url.pathname === '/' ? '/index.html' : url.pathname));
  if (!file.startsWith(ROOT) || !/^\/(index\.html|css\/|js\/|favicon)/.test(url.pathname === '/' ? '/index.html' : url.pathname) || !fs.existsSync(file)) {
    res.writeHead(404).end('Not found');
    return;
  }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
}).listen(port, () => console.log(`Scale Architect on http://localhost:${port}  (DesignGame: ${fake ? 'stand-in model' : 'Claude'}, passcode "${env.DESIGNGAME_PASSCODE}")`));
