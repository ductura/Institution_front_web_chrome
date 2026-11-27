// Razvojni poslužitelj starog npm kostura (E-0.3): / i /api/documents s
// memorijskim oponašateljem, za e2e matricu (DAN-755). Front institucije pod
// /aplikacija/ je Next.js aplikacija u packages/app (`pnpm dev`),
// koja /api/v1/* sama prosljeđuje Institution_serveru.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = fileURLToPath(new URL('.', import.meta.url));
const root = join(here, 'public');
const types = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2', '.ico': 'image/x-icon',
};
const docs = new Map([
  ['demo-1', { id: 'demo-1', title: 'Seminarski rad', content: 'Uvod u temu.' }],
  ['demo-2', { id: 'demo-2', title: 'Bilješke s predavanja', content: '' }],
]);

const json = (res, status, body) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)); };

const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
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
server.listen(port, () => console.log(`Ductura (stari kostur) na http://localhost:${port}/`));
