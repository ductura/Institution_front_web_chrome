// In-memory stand-in for collaboration.comments.post (/api/v1/comments/<action>) for the tests of
// the real port (PIL-K-KOMENTARI-EDITOR). Invented texts and ids only.
export const ORIGIN = "https://ductura.example.invalid";
const T1 = "aaaaaaaa-0000-4000-8000-000000000001";
const T2 = "aaaaaaaa-0000-4000-8000-000000000002";
export const ANCHOR = {
  nodeId: "0f8e2a64-1b3c-4d5e-8f60-718293a4b5c6", quote: "kućno kompostiranje", prefix: "Tema je ", suffix: " u gradu",
  startHint: 8, endHint: 27,
};

type Row = { threadId: string; commentId: string; position: number; authorRole: "teacher" | "student"; isOwn: boolean; body: string | null; anchor: unknown; state: string; createdWindow: string; deletedWindow: string | null };

/** The route of the server, in memory: the student may reply; `status` forces an answer. */
export function fakeRoute(opts: { status?: number; teacherOnly?: boolean } = {}) {
  let n = 0;
  const id = () => `bbbbbbbb-0000-4000-8000-${String(++n).padStart(12, "0")}`;
  const rows: Row[] = [
    { threadId: T1, commentId: id(), position: 1, authorRole: "teacher", isOwn: false, body: "Tvrdnja traži izvor.", anchor: ANCHOR, state: "open", createdWindow: "2026-11-20T10:05:00.000Z", deletedWindow: null },
    { threadId: T1, commentId: id(), position: 2, authorRole: "student", isOwn: true, body: "Dodat ću izvor.", anchor: null, state: "open", createdWindow: "2026-11-20T11:00:00.000Z", deletedWindow: null },
    { threadId: T2, commentId: id(), position: 1, authorRole: "teacher", isOwn: false, body: "Jasan uvod.", anchor: null, state: "resolved", createdWindow: "2026-11-20T10:10:00.000Z", deletedWindow: null },
  ];
  const calls: { action: string; body: Record<string, unknown> }[] = [];
  const json = (status: number, body?: unknown) => new Response(body === undefined ? null : JSON.stringify(body), {
    status, headers: body === undefined ? {} : { "content-type": "application/json" },
  });
  const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => {
    const action = String(url).split("/").at(-1)!;
    const body = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
    calls.push({ action, body });
    if (action === "list") return json(200, { comments: rows });
    if (opts.status) return json(opts.status);
    if (action === "reply") {
      const thread = rows.filter((r) => r.threadId === body.threadId);
      if (thread.length === 0) return json(403);
      rows.splice(rows.indexOf(thread.at(-1)!) + 1, 0, { ...thread[0]!, commentId: id(), position: thread.length + 1, authorRole: "student", isOwn: true, body: String(body.body), anchor: null, createdWindow: "2026-11-23T09:00:00.000Z" });
      return json(200, { id: rows.at(-1)!.commentId });
    }
    if (opts.teacherOnly) return json(403);
    if (action === "resolve" || action === "reopen") {
      for (const r of rows) if (r.threadId === body.threadId) r.state = action === "resolve" ? "resolved" : "open";
      return json(204);
    }
    return json(404);
  }) as typeof fetch;
  return { fetchImpl, calls, options: { baseUrl: ORIGIN, fetchImpl } };
}

// A test file, so the scans for direct calls leave this stand-in alone; it checks itself once.
import { expect, it } from "vitest";
it("the stand-in route lists its invented threads", async () => {
  const route = fakeRoute();
  const answer = await route.fetchImpl(`${ORIGIN}/x/list`, { method: "POST", body: "{}" });
  expect(((await answer.json()) as { comments: unknown[] }).comments).toHaveLength(3);
});
