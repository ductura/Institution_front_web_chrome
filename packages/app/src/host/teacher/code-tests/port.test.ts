import { describe, expect, it, vi } from "vitest";

import { fakeCodeTestsPort, FAKE_ASSIGNMENT } from "./fake-port";
import { codeTestsPortFor } from "./port";

const A = FAKE_ASSIGNMENT;
const BODY = { language: "javascript", tests: [{ id: "t1", title: "Zbroj", input: [1, 2], expected: 3 }] } as const;
const fail = (status: number, code: string) => ({ ok: false as const, status, code });
const portOf = (answer: unknown) => codeTestsPortFor(() => (vi.fn(async () => answer) as never));
const broken = codeTestsPortFor(() => (vi.fn(async () => { throw new Error("offline"); }) as never));

describe("the real code-test port", () => {
  it("reads the latest revision", async () => {
    const view = { revisionNo: 2, language: "javascript", tests: [] };
    expect(await portOf({ ok: true, status: 200, body: view }).read(A)).toEqual({ kind: "ok", view });
  });
  it("tells 404, 401 and 503 apart and never turns a refusal into an empty list", async () => {
    expect(await portOf(fail(404, "not_found")).read(A)).toEqual({ kind: "notFound" });
    expect(await portOf(fail(401, "unauthorized")).read(A)).toEqual({ kind: "signedOut" });
    expect(await portOf(fail(503, "unavailable")).read(A)).toEqual({ kind: "unavailable" });
    expect(await broken.read(A)).toEqual({ kind: "unavailable" });
  });
  it("sends the body to PUT with the assignment id and answers with the new revision", async () => {
    const call = vi.fn(async () => ({ ok: true, status: 200, body: { revisionNo: 1, ...BODY } }));
    const result = await codeTestsPortFor(() => call as never).write(A, BODY);
    expect(call).toHaveBeenCalledWith("teacher.assignment-code-tests.put", { params: { assignmentId: A }, query: undefined, body: BODY });
    expect(result).toMatchObject({ kind: "done", view: { revisionNo: 1 } });
  });
  it("maps write refusals; a lost answer or 503 is unknown, never done", async () => {
    expect(await portOf(fail(422, "invalid_code_tests")).write(A, BODY)).toEqual({ kind: "invalid" });
    expect(await portOf(fail(413, "body_too_large")).write(A, BODY)).toEqual({ kind: "invalid" });
    expect(await portOf(fail(403, "forbidden")).write(A, BODY)).toEqual({ kind: "forbidden" });
    expect(await portOf(fail(404, "not_found")).write(A, BODY)).toEqual({ kind: "notFound" });
    expect(await portOf(fail(401, "unauthorized")).write(A, BODY)).toEqual({ kind: "signedOut" });
    expect(await portOf(fail(503, "unavailable")).write(A, BODY)).toEqual({ kind: "unknown" });
    expect(await broken.write(A, BODY)).toEqual({ kind: "unknown" });
  });
});

describe("the fake code-test port", () => {
  it("appends revisions and answers 404 for an assignment it does not hold", async () => {
    const fake = fakeCodeTestsPort();
    expect(await fake.write(A, BODY)).toMatchObject({ kind: "done", view: { revisionNo: 1 } });
    expect(await fake.write(A, { language: "javascript", tests: [] })).toMatchObject({ view: { revisionNo: 2 } });
    expect(fake.revisions(A)).toHaveLength(3);
    expect(fake.revisions(A)[1]!.tests).toHaveLength(1);
    const other = "22222222-2222-4222-8222-222222222222";
    expect(await fake.read(other)).toEqual({ kind: "notFound" });
    expect(await fake.write(other, BODY)).toEqual({ kind: "notFound" });
  });
});
