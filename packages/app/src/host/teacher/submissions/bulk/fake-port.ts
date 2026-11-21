// An in-memory server for the bulk download (WEB-1902), invented data. Tests and the catalogue only.
import type { BulkCall, BulkStatus } from "./contract";

export const ASSIGNMENT = "00000000-0000-4000-8000-0000000000a1";
const ok = (status: number, body: unknown) => ({ ok: true as const, status, body });

export function fakeBulkServer(start: BulkStatus = { state: "idle", submissionCount: 2 }, opts: { forbid?: boolean } = {}) {
  let status = start;
  const posts: unknown[] = [];
  const call: BulkCall = async (id, input) => {
    if (opts.forbid === true) return { ok: false as const, status: 403, code: "forbidden" };
    if (id === "teacher.submissions-bulk.get") return ok(200, status);
    posts.push(input.body);
    if (status.state === "idle") status = { state: "preparing", submissionCount: status.submissionCount };
    return ok(202, status);
  };
  return {
    call, posts,
    finish(expiresAt: string) {
      if (status.state === "preparing") status = { state: "ready", submissionCount: status.submissionCount, href: "/preuzimanje/predaje-izmisljeno.zip", expiresAt };
    },
    expire() { if (status.state === "ready") status = { state: "idle", submissionCount: status.submissionCount }; },
  };
}
