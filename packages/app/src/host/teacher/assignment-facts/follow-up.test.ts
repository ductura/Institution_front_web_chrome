// NAS-R02: teacher.assignment-follow-up.get through createApi's `call`. Invented ids only.
import { describe, expect, it } from "vitest";

import { followUp, openRevisions, type FactsCall } from "./read";

const S1 = "00000000-0000-4000-8000-000000000001";
const S2 = "00000000-0000-4000-8000-000000000002";
const A1 = "00000000-0000-4000-8000-0000000000a1";
const calls: string[] = [];
const fake = (answer: unknown): FactsCall => (async (id: string, input: { params: { assignmentId: string } }) => {
  calls.push(`${id} ${input.params.assignmentId}`);
  if (answer instanceof Error) throw answer;
  return answer;
}) as unknown as FactsCall;
const item = (studentId: string, over: Record<string, unknown> = {}) => ({
  studentId, noticeReadAt: null, noticeAcknowledgedAt: null, noticeVersionNo: null, revisionState: null, revisionChangedAt: null, openRevisionCount: 0, ...over,
});
const ok = (students: unknown[]) => ({ ok: true, status: 200, body: { students } });

describe("followUp (NAS-R02)", () => {
  it("reads the route of the assignment by student", async () => {
    const read = await followUp(fake(ok([item(S1, { noticeAcknowledgedAt: "2026-11-02T10:00:00.000Z", openRevisionCount: 2, revisionState: "open", revisionChangedAt: "2026-11-03T10:00:00.000Z" }), item(S2)])), A1);
    expect(calls.at(-1)).toBe(`teacher.assignment-follow-up.get ${A1}`);
    expect(read?.get(S1)?.openRevisionCount).toBe(2);
    expect(read?.get(S2)?.noticeAcknowledgedAt).toBeNull();
    expect(openRevisions(read)).toBe(2);
  });
  it("a refusal, a throw or a repeated student is null, never an empty list", async () => {
    expect(await followUp(fake({ ok: false, status: 403, code: "forbidden" }), A1)).toBeNull();
    expect(await followUp(fake({ ok: false, status: 503, code: "unavailable" }), A1)).toBeNull();
    expect(await followUp(fake(new Error("net")), A1)).toBeNull();
    expect(await followUp(fake(ok([item(S1), item(S1)])), A1)).toBeNull();
    expect(openRevisions(null)).toBeNull();
  });
  it("an assignment without students has zero open revisions, not unavailable", async () => {
    expect(openRevisions(await followUp(fake(ok([])), A1))).toBe(0);
  });
});
