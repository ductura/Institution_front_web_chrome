// PR-19: the VIZ "puno" submission of T1, checked against the contract's own response schemas,
// so a screen reading through the generated client never sees a shape it refuses.
import { describe, expect, it } from "vitest";

import { RESPONSES } from "../../../src/client/api";
import { matchesSchema, type Schema } from "../../../src/client/schema-check";
import { generatedServer } from "../e2e/viz/server";
import { DOKUMENT_T1, ISHODI_PREDAJE, REVIZIJA_T1 } from "./viz-predaja";
import { T1, T3, type Answer, type Result } from "./viz-scenariji";

const answered = (r: Result) => r as Answer;
const body = (r: Result) => JSON.parse(answered(r).body ?? "null") as Record<string, any>;
const schema = (id: string, status = "200") => RESPONSES.get(id)?.[status]?.content?.["application/json"]?.schema as Schema;
const fits = (id: string, r: Result) => expect(matchesSchema(schema(id), body(r)), id).toBe(true);
const SENT = JSON.stringify({ documentId: DOKUMENT_T1, revision: REVIZIJA_T1 });
const paths = {
  declaration: `/api/v1/student/assignments/${T1}/declaration`,
  state: `/api/v1/student/assignments/${T1}/submission`,
  withdrawal: `/api/v1/student/assignments/${T1}/submission/withdrawal`,
  history: `/api/v1/student/assignments/${T1}/submission/history`,
};

describe("PR-19: the puno student submits T1 on the fake server", () => {
  it("opens the text of the declaration it confirmed: same document, same revision", () => {
    const s = generatedServer("puno");
    const opened = body(s.answer("student", "POST", "/api/v1/evidence/open", JSON.stringify({ assignmentId: T1 })));
    const declaration = s.answer("student", "GET", paths.declaration);
    fits("student.declaration.get", declaration);
    expect(body(declaration)).toMatchObject({ state: "confirmed", currentRevision: opened.currentRevision, payload: { documentId: opened.documentId, revision: opened.currentRevision, assignmentId: T1 } });
    expect(opened).toMatchObject({ documentId: DOKUMENT_T1, currentRevision: REVIZIJA_T1, submitted: false });
    expect(body(s.answer("student", "GET", paths.state))).toEqual({ state: "none" });
  });

  it("a submission is signed for what was sent, then read back, withdrawn and listed in the history", () => {
    const s = generatedServer("puno");
    const submitted = s.answer("student", "POST", "/api/v1/submission/v2", SENT);
    expect(answered(submitted).status).toBe(200);
    fits("submission.submit-second.post", submitted);
    const receipt = body(submitted).receipt;
    expect(receipt.payload).toMatchObject({ assignmentId: T1, documentId: DOKUMENT_T1, revision: REVIZIJA_T1, afterDeadline: false });
    expect(receipt.payload.requestedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/);
    expect(body(s.answer("student", "GET", paths.state))).toEqual({ state: "potvrdeno", receipt });
    expect(body(s.answer("student", "GET", paths.declaration))).toMatchObject({ state: "bound", submitted: true });
    expect(body(s.answer("student", "GET", paths.withdrawal))).toEqual({ withdrawable: true, receipts: [] });
    // A second press is the server's already_requested for the revision it holds.
    expect(body(s.answer("student", "POST", "/api/v1/submission/v2", SENT))).toEqual({ status: "already_requested", revision: REVIZIJA_T1 });

    const withdrawn = s.answer("student", "POST", paths.withdrawal, "{}");
    fits("student.submission-withdrawal.post", withdrawn);
    expect(body(withdrawn).receipt.payload).toMatchObject({ assignmentId: T1, submissionId: receipt.payload.submissionId });
    expect(body(s.answer("student", "GET", paths.state))).toEqual({ state: "none" });
    const after = s.answer("student", "GET", paths.withdrawal);
    fits("student.submission-withdrawal.get", after);
    expect(body(after)).toMatchObject({ withdrawable: false, receipts: [{ assignmentId: T1, revision: REVIZIJA_T1 }] });
    const history = s.answer("student", "GET", paths.history);
    fits("student.submission-history.get", history);
    expect(body(history).events.map((e: { kind: string }) => e.kind)).toEqual(["submission", "withdrawal"]);
    // Nothing left to withdraw: the contract's 409.
    expect(answered(s.answer("student", "POST", paths.withdrawal, "{}")).status).toBe(409);
  });

  it("every outcome of a run is the contract's answer for it, and only a submitted one is read back", () => {
    const expected: Record<string, { status: number; body: unknown }> = {
      "nije-otvoreno": { status: 409, body: { status: "not_open" } },
      odbijeno: { status: 409, body: { status: "blocked", reason: "no_evidence" } },
      izjava: { status: 409, body: { status: "declaration_required" } },
      nepoznato: { status: 503, body: { status: "unavailable", stage: "signing" } },
      "vec-zatrazeno": { status: 409, body: { status: "already_requested", revision: REVIZIJA_T1 } },
    };
    for (const ishod of ISHODI_PREDAJE.filter((i) => i !== "predano")) {
      const s = generatedServer("puno", { predaja: ishod });
      const r = s.answer("student", "POST", "/api/v1/submission/v2", SENT);
      expect({ status: answered(r).status, body: body(r) }, ishod).toEqual(expected[ishod]);
      const state = body(s.answer("student", "GET", paths.state));
      expect(state.state, ishod).toBe(ishod === "vec-zatrazeno" ? "ceka" : "none");
    }
  });

  it("the submitted T3 still answers from the contract's vectors, and prazno has no submission at all", () => {
    const s = generatedServer("puno");
    expect(body(s.answer("student", "GET", `/api/v1/student/assignments/${T3}/submission`)).state).toBe("potvrdeno");
    expect(body(generatedServer("prazno").answer("student", "GET", paths.declaration)).state).toBe("none");
  });
});
