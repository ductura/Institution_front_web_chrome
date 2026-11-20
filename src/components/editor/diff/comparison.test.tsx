import { once } from "node:events";
import { createServer } from "node:http";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";

import { ComparisonResult } from "./ComparisonResult";
import { readComparison, readSubmittedVersions, type Comparison, type ComparisonApi } from "./comparison-read";

const savedMinute = "2026-11-20T10:00:00.000Z";
const from = { revision: 3, kind: "submission" } as const;
const to = { revision: 7, kind: "submission" } as const;
const comparison: Comparison = {
  from, to,
  blocks: [
    { op: "same", words: [{ op: "same", text: "U vrtu." }] },
    { op: "changed", words: [{ op: "removed", text: "Kadulja" }, { op: "added", text: "Metvica" }] },
  ],
  counts: { addedWords: 42, removedWords: 18 },
  truncated: false,
};

it("reads versions and comparisons from a fake server and renders its diff and counts", async () => {
  const requests: string[] = [];
  const server = createServer((request, response) => {
    const address = new URL(request.url ?? "/", "http://localhost");
    requests.push(address.pathname + address.search);
    const [, , , , work, route] = address.pathname.split("/");
    response.setHeader("Content-Type", "application/json");
    if (work === "missing" || work === "offline") {
      response.writeHead(work === "missing" ? 404 : 503).end("{}");
    } else if (route === "compare") {
      response.writeHead(200).end(JSON.stringify({ ...comparison, truncated: work === "limited" }));
    } else if (address.searchParams.get("beforeRevision") === "5") {
      response.writeHead(200).end(JSON.stringify({ versions: [{ ...from, savedMinute, afterDeadline: false }], nextBeforeRevision: null }));
    } else {
      const versions = [{ ...to, savedMinute, afterDeadline: false }, { kind: "checkpoint", revision: 5, savedMinute }];
      response.writeHead(200).end(JSON.stringify({ versions, nextBeforeRevision: work === "single" ? null : 5 }));
    }
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Missing test server port");
    // Test-only transport until the published OpenAPI includes work.compare.get.
    const api: ComparisonApi = async (id, { params, query }) => {
      const route = id === "work.versions.get" ? "versions" : "compare";
      const url = new URL(`/api/v1/works/${params.documentId}/${route}`, `http://127.0.0.1:${address.port}`);
      for (const [name, value] of Object.entries(query)) if (value !== undefined) url.searchParams.set(name, value);
      const response = await fetch(url);
      return response.ok ? { ok: true, body: await response.json() } : { ok: false, status: response.status };
    };

    const versions = await readSubmittedVersions(api, "demo-work");
    expect(versions.kind === "ready" && versions.value.map(({ revision }) => revision)).toEqual([7, 3]);
    expect(requests[1]).toBe("/api/v1/works/demo-work/versions?beforeRevision=5");
    const single = await readSubmittedVersions(api, "single");
    expect(single.kind === "ready" && single.value.map(({ revision }) => revision)).toEqual([7]);
    await expect(readSubmittedVersions(api, "offline")).resolves.toEqual({ kind: "error" });
    await expect(readSubmittedVersions(api, "missing")).resolves.toEqual({ kind: "not-found" });

    const result = await readComparison(api, "demo-work", 3, 7);
    expect(requests.at(-1)).toBe("/api/v1/works/demo-work/compare?from=3&to=7");
    if (result.kind !== "ready") throw new Error("Missing comparison");
    const html = renderToStaticMarkup(<ComparisonResult comparison={result.value} onlyChanges />);
    expect(html).toContain("Dodano 42 riječi");
    expect(html).toContain("Uklonjeno 18 riječi");
    expect(html).toMatch(/<ins[^>]*>.*Dodano: <\/span>Metvica<\/ins>/i);
    expect(html).toMatch(/<del[^>]*>.*Uklonjeno: <\/span>Kadulja<\/del>/i);
    expect(html).not.toContain("U vrtu.");
    expect(renderToStaticMarkup(<ComparisonResult comparison={result.value} onlyChanges={false} />)).toContain("U vrtu.");

    const count = requests.length;
    await expect(readComparison(api, "demo-work", 7, 7)).resolves.toEqual({ kind: "error" });
    expect(requests).toHaveLength(count);
    await expect(readComparison(api, "demo-work", 7, 3)).resolves.toEqual({ kind: "error" });
    await expect(readComparison(api, "offline", 3, 7)).resolves.toEqual({ kind: "error" });
    await expect(readComparison(api, "missing", 3, 7)).resolves.toEqual({ kind: "not-found" });

    const limited = await readComparison(api, "limited", 3, 7);
    if (limited.kind !== "ready") throw new Error("Missing limited comparison");
    expect(renderToStaticMarkup(<ComparisonResult comparison={limited.value} onlyChanges />)).toContain("Prikazan je samo dio razlika.");
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
