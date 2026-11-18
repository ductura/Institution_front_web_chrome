// Razvojni poslužitelj na :5173 (ugovor #2028 c.6993786629 §1):
// - /app/web/* i /app/chrome/*: front institucije (packages/app, `pnpm build`),
//   svaka putanja bez datoteke dobiva index.html, pa router aplikacije bira ekran;
// - /api/v1/*: prosljeđuje se Institution_serveru (INSTITUTION_SERVER_URL,
//   zadano http://127.0.0.1:4000) s kolačićima, za izravan rad na :5173. Preko
//   edgea na :8000 te zahtjeve ionako prima Institution_server;
// - / i /api/documents: stari npm kostur s memorijskim oponašateljem (E-0.3).
import { createServer, request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = fileURLToPath(new URL('.', import.meta.url));
const root = join(here, 'public');
const appRoot = join(here, 'packages', 'app', 'dist');
const APP_BASES = ['/app/web', '/app/chrome'];
const upstream = new URL(process.env.INSTITUTION_SERVER_URL ?? 'http://127.0.0.1:4000');
const types = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2', '.ico': 'image/x-icon',
};
const docs = new Map([
  ['demo-1', { id: 'demo-1', title: 'Seminarski rad', content: 'Uvod u temu.' }],
  ['demo-2', { id: 'demo-2', title: 'Bilješke s predavanja', content: '' }],
]);

const json = (res, status, body) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)); };

/** The base of an app path, or undefined for any other path. */
const appBaseOf = (pathname) => APP_BASES.find((b) => pathname === b || pathname.startsWith(`${b}/`));

/** A built file of the app, or its index.html for every path that is not one. */
async function serveApp(res, pathname, base) {
  let rest = '/';
  try { rest = normalize(decodeURIComponent(pathname.slice(base.length)) || '/'); } catch { /* malformed: index.html */ }
  const file = join(appRoot, rest);
  let target = join(appRoot, 'index.html');
  if (file.startsWith(appRoot + sep)) {
    try { if ((await stat(file)).isFile()) target = file; } catch { /* no such file: the app's own route */ }
  }
  try {
    const body = await readFile(target);
    const isIndex = target === join(appRoot, 'index.html');
    res.writeHead(200, {
      'content-type': types[extname(target)] ?? 'application/octet-stream',
      'cache-control': isIndex ? 'no-cache' : 'public, max-age=31536000, immutable',
    });
    res.end(body);
  } catch {
    res.writeHead(503, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('Front institucije nije izgrađen. Pokrenite pnpm build.\n');
  }
}

/** /api/v1/* to the institution server, as it is: method, headers, body, status, Set-Cookie, Location. */
function proxyApi(req, res) {
  const send = upstream.protocol === 'https:' ? httpsRequest : httpRequest;
  const out = send({
    protocol: upstream.protocol, hostname: upstream.hostname, port: upstream.port,
    method: req.method, path: req.url, headers: req.headers,
  }, (answer) => {
    res.writeHead(answer.statusCode ?? 502, answer.headers);
    answer.pipe(res);
  });
  out.on('error', () => {
    if (!res.headersSent) json(res, 502, { code: 'unavailable' });
    else res.destroy();
  });
  req.pipe(out);
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname.startsWith('/api/v1/')) return proxyApi(req, res);
  const base = appBaseOf(url.pathname);
  if (base) return serveApp(res, url.pathname, base);
  if (url.pathname === '/api/documents') return json(res, 200, [...docs.values()]);
  const m = url.pathname.match(/^\/api\/documents\/([\w-]+)$/);
  if (m) {
    const doc = docs.get(m[1]);
    if (!doc) return json(res, 404, { error: 'Nije pronađeno' });
    if (req.method === 'PUT') {
      let raw = ''; for await (const c of req) raw += c;
      const body = JSON.parse(raw || '{}');
      docs.set(doc.id, { ...doc, title: body.title ?? doc.title, content: body.content ?? doc.content });
    }
    return json(res, 200, docs.get(doc.id));
  }
  const path = normalize(url.pathname === '/' ? '/index.html' : url.pathname);
  try {
    const file = await readFile(join(root, path));
    res.writeHead(200, { 'content-type': types[extname(path)] ?? 'application/octet-stream' });
    res.end(file);
  } catch { res.writeHead(404).end(); }
});

const port = Number(process.env.PORT ?? 5173);
server.listen(port, () => console.log(`Ductura (dev) na http://localhost:${port}/app/web/ (API: ${upstream.origin})`));
