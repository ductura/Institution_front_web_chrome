import { describe, expect, it } from "vitest";

import vectors from "../../../../../../src/client/migration-contract-vectors.generated.json" with { type: "json" };
import { createApi } from "../../../../../../src/client/api.ts";
import type { SubmissionsCall } from "../../../../../../src/client/teacher-submissions.ts";
import { failureMessage } from "./model";
import { submissionsMessages as text } from "./messages.hr";
import { clientSubmissionsPort, signInReturn, submissionsHref } from "./port";

// PIL-D2-PREDAJE: the real port over createApi, answered by the contract's own vectors
// (migration-contract-vectors.generated.json), so the shapes are the server's, not local copies.
type Vector = {
  route: string; name: string;
  request: { params: Record<string, string> };
  response: { status: number; contentType?: string; body?: unknown };
};
const all = vectors as unknown as Vector[];
const vector = (route: string, name: string): Vector => {
  const found = all.find((v) => v.route === route && v.name === name);
  if (found === undefined) throw new Error(`vector missing: ${route} ${name}`);
  return found;
};
const LIST = "teacher.submissions.get";
const DETAIL = "teacher.submission-detail.get";

function portAnswering(v: Vector) {
  const asked: string[] = [];
  let expired = 0;
  const fetchImpl: typeof fetch = async (url) => {
    asked.push(new URL(String(url)).pathname);
    return new Response(v.response.body === undefined ? null : JSON.stringify(v.response.body), {
      status: v.response.status, headers: { "content-type": v.response.contentType ?? "application/json" },
    });
  };
  const call = createApi({ baseUrl: "http://ductura.test", fetchImpl }) as unknown as SubmissionsCall;
  return { port: clientSubmissionsPort(call, () => { expired += 1; }), asked, expired: () => expired };
}

describe("submissions port over the contract (PIL-D2-PREDAJE)", () => {
  it("lists the submitted versions of the teacher's assignment, and only submitted ones", async () => {
    const v = vector(LIST, "submissions");
    const { port, asked } = portAnswering(v);
    const read = await port.list(v.request.params.assignmentId ?? "");
    expect(asked).toEqual([`/api/v1/teacher/assignments/${v.request.params.assignmentId}/submissions`]);
    if (read.kind !== "ready") throw new Error(read.kind);
    expect(read.rows).toEqual([
      { studentId: "5e4d3c2b-1a09-4f8e-8d7c-6b5a4f3e2d01", revision: 42, late: false, requestedMinute: "2026-12-15T21:30:00.000Z" },
    ]);
  });

  it("opens one submitted version by student", async () => {
    const v = vector(DETAIL, "submitted-version");
    const { port } = portAnswering(v);
    const read = await port.open(v.request.params.assignmentId ?? "", v.request.params.studentId ?? "");
    expect(read).toMatchObject({ kind: "ready", version: { revision: 42, late: false } });
  });

  it("gives another teacher's or a student's refusal as a calm message, without any data", async () => {
    for (const route of [LIST, DETAIL]) {
      const v = vector(route, "forbidden");
      const { port } = portAnswering(v);
      const read = route === LIST ? await port.list("a") : await port.open("a", "s");
      expect(read).toEqual({ kind: "greska", code: "not_found" });
      expect(failureMessage(read, route === LIST ? "list" : "version")).toBe(route === LIST ? text.noAccess : text.notFound);
    }
    const missing = await portAnswering(vector(DETAIL, "not-found")).port.open("a", "s");
    expect(missing).toEqual({ kind: "greska", code: "not_found" });
  });

  it("keeps the contract's empty list for an assignment that is not the teacher's (no 404 in the contract)", async () => {
    const read = await portAnswering(vector(LIST, "none-or-not-the-teacher")).port.list("a");
    expect(read).toEqual({ kind: "ready", rows: [] });
  });

  it("sends an ended session to sign-in and an unavailable server to a retry, never an empty list", async () => {
    const signedOut = portAnswering(vector(LIST, "unauthorized"));
    expect(await signedOut.port.list("a")).toEqual({ kind: "session-expired" });
    expect(signedOut.expired()).toBe(1);
    const down = portAnswering(vector(LIST, "unavailable"));
    expect(await down.port.list("a")).toEqual({ kind: "nepoznato" });
    expect(down.expired()).toBe(0);
  });

  it("links the page of one assignment", () => {
    expect(submissionsHref("3a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c01")).toBe("/nastavnik/zadatak/3a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c01/predaje");
    expect(signInReturn("/app/chrome", "z1")).toBe("/app/chrome/nastavnik/zadatak/z1/predaje");
    expect(signInReturn("/app/web", "z1")).toBe("/app/web/nastavnik/zadatak/z1/predaje");
  });
});
