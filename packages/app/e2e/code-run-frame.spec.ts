import { createServer, type Server } from "node:http";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";

// WEB-V21-KOD-POKRETANJE: the frame page runs the student's code under the frame's own CSP, inside a page whose CSP
// has worker-src 'none' and a nonce with 'strict-dynamic' (the stricter case of §5). A small server gives the frame
// the header PL-CSP-OKVIR sets and the embedding page its strict one; the page speaks the frame's protocol directly.
const PUBLIC = join(import.meta.dirname, "../public/code-run");
const FRAME_CSP = "default-src 'none'; script-src 'self'; worker-src blob:; frame-ancestors 'self'";
const NONCE = "abc123nonce";
const PAGE_CSP = `default-src 'none'; script-src 'nonce-${NONCE}' 'strict-dynamic'; worker-src 'none'; frame-src 'self'; connect-src 'self'`;

const PAGE = `<!doctype html><meta charset=utf-8><body><script nonce="${NONCE}">
window.runFrame = (code, tests) => new Promise((resolve) => {
  const f = document.createElement("iframe");
  f.setAttribute("sandbox", "allow-scripts");
  f.src = "/code-run/frame.html";
  window.addEventListener("message", (e) => {
    if (e.source !== f.contentWindow) return;
    if (e.data.type === "ready") f.contentWindow.postMessage({ type: "run", runId: "r", code, tests }, "*");
    else if (e.data.type === "results") { f.remove(); resolve(e.data); }
  });
  document.body.append(f);
});
</script></body>`;

let server: Server;
let origin = "";
let hits: string[] = [];
test.beforeAll(async () => {
  server = createServer((req, res) => {
    const url = req.url ?? "/";
    hits.push(url);
    if (url === "/page") { res.writeHead(200, { "content-type": "text/html", "content-security-policy": PAGE_CSP }).end(PAGE); return; }
    if (url === "/code-run/frame.html" || url === "/code-run/frame.js") {
      const name = url.split("/").pop()!;
      res.writeHead(200, { "content-type": name.endsWith(".js") ? "text/javascript" : "text/html", "content-security-policy": FRAME_CSP }).end(readFileSync(join(PUBLIC, name)));
      return;
    }
    res.writeHead(200, { "content-type": "application/json", "access-control-allow-origin": "*" }).end("{}");
  });
  await new Promise<void>((ok) => server.listen(0, "127.0.0.1", ok));
  origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
});
test.afterAll(() => { server.close(); });

type Answer = { missingSolve: boolean; results: { id: string; status: string; actual?: unknown; message?: string }[] };
async function run(page: Page, code: string, tests: unknown[]): Promise<Answer> {
  await page.goto(`${origin}/page`);
  return page.evaluate(([c, t]) => (window as unknown as { runFrame: (c: string, t: unknown[]) => Promise<Answer> }).runFrame(c as string, t as unknown[]), [code, tests] as const);
}
const tests = [{ id: "t1", input: [2, 3], expected: 5 }, { id: "t2", input: [1, 1], expected: 3 }];

test("correct code reaches a result under both CSPs; a wrong answer fails with the value", async ({ page }) => {
  const answer = await run(page, "function solve([a, b]) { return a + b; }", tests);
  expect(answer.results.map((r) => r.status)).toEqual(["passed", "failed"]);
  expect(answer.results[1]!.actual).toBe(2);
});

test("an endless loop times out and does not freeze the page", async ({ page }) => {
  const started = Date.now();
  const answer = await run(page, "function solve() { while (true) {} }", [tests[0]]);
  expect(answer.results[0]!.status).toBe("timeout");
  expect(Date.now() - started).toBeLessThan(6000);
  expect(await page.evaluate(() => 1 + 1)).toBe(2);
});

test("fetch, XMLHttpRequest, WebSocket and importScripts from the code do not succeed", async ({ page }) => {
  hits = [];
  const code = `
    async function solve() {
      const out = {};
      try { await fetch("${"${ORIGIN}"}/leak"); out.fetch = "ok"; } catch (e) { out.fetch = "blocked"; }
      try { const x = new XMLHttpRequest(); x.open("GET", "${"${ORIGIN}"}/leak", false); x.send(); out.xhr = "ok"; } catch (e) { out.xhr = "blocked"; }
      try { new WebSocket("ws://127.0.0.1:9/leak"); out.ws = "ok"; } catch (e) { out.ws = "blocked"; }
      try { importScripts("${"${ORIGIN}"}/leak.js"); out.imp = "ok"; } catch (e) { out.imp = "blocked"; }
      return out;
    }`.replaceAll("${ORIGIN}", origin);
  const answer = await run(page, code, [{ id: "t1", input: null, expected: { fetch: "blocked", xhr: "blocked", ws: "blocked", imp: "blocked" } }]);
  expect(answer.results[0]).toMatchObject({ status: "passed" });
  expect(hits.filter((u) => u.startsWith("/leak"))).toEqual([]);
});

test("a code without solve and a throwing code are told apart", async ({ page }) => {
  expect((await run(page, "const a = 1;", [tests[0]])).missingSolve).toBe(true);
  const thrown = await run(page, "function solve() { throw new Error('boom'); }", [tests[0]]);
  expect(thrown.results[0]).toMatchObject({ status: "error", message: "boom" });
  const syntax = await run(page, "function solve( {", [tests[0]]);
  expect(syntax.results[0]!.status).toBe("error");
});
