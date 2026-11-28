// NF-3 PR-20 (R-33), NF-5 PG-6: the teacher's question beside the declaration and the student's
// answer, through the declaration adapter over declaration-v1. Invented data only.
import { describe, expect, it } from "vitest";

import { createApi } from "./api";
import { createDeclarationPort, heldAnswer, nextDraft } from "./declaration";
import contracts from "./migration-contracts.generated.json" with { type: "json" };
import { matchesSchema, type Schema } from "./schema-check";
import { createDeclarationStepPorts } from "./statement";

const ASSIGNMENT = "00000000-0000-4000-8000-0000000000a1";
const QUESTION = { questionId: "00000000-0000-4000-8000-0000000000e1", text: "Koji Vam je izmišljeni izvor najviše pomogao?" };
const OLD_QUESTION_ID = "00000000-0000-4000-8000-0000000000e0";
const ANSWER = { questionId: QUESTION.questionId, questionText: QUESTION.text, text: "Izmišljeni udžbenik iz metodologije." };
const FORM = { formId: "test-izjava", formVersion: 1, formSha256: "a".repeat(64) };
const DRAFT = {
  baseVersion: 3, revision: 2, form: FORM, ownWork: { confirmed: false },
  humanHelp: { received: false, entries: [] },
  ai: { use: "not_used", declaredTools: [], attachments: [], externalAttachmentIds: [] },
  confirm: false,
};
const STATE = {
  state: "draft", submitted: false, currentRevision: 2, version: 4, formText: "Izmišljeni obrazac.",
  currentForm: { ...FORM, text: "Izmišljeni obrazac." }, draft: DRAFT, payload: null, declarationSha256: null, uploads: [],
  declarationRequired: true, teacherQuestion: QUESTION as typeof QUESTION | null, questionAnswer: null as typeof ANSWER | null,
};
type State = typeof STATE;
const PUT_SCHEMA = contracts["student.declaration-second.put"].body as Schema;
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const error = (status: number, code: string) => json(status, { error: code, code, messageKey: "errors.x", status, requestId: "00000000-0000-4000-8000-000000000000" });

function server(answer: (method: string, body: unknown) => Response) {
  const sent: { method: string; body: unknown }[] = [];
  const fetchImpl: typeof fetch = async (_input, init) => {
    const method = init?.method ?? "GET";
    const body: unknown = typeof init?.body === "string" ? JSON.parse(init.body) : undefined;
    sent.push({ method, body });
    return answer(method, body);
  };
  return { sent, call: createApi({ baseUrl: "https://ductura.example.invalid", fetchImpl }) };
}

/** A server that keeps the answer a PUT sends (null takes it back). */
function answeringServer(start: State) {
  let state = { ...start };
  return server((method, body) => {
    if (method === "GET") return json(200, state);
    const put = body as { questionAnswer?: { questionId: string; text: string } | null };
    if ("questionAnswer" in put) {
      state = { ...state, questionAnswer: put.questionAnswer ? { ...put.questionAnswer, questionText: QUESTION.text } : null };
    }
    state = { ...state, version: state.version + 1 };
    return json(200, state);
  });
}

describe("the answer in a draft (NF-3 PR-20)", () => {
  type Draftable = Parameters<typeof nextDraft>[0];
  const as = (s: State) => s as unknown as Draftable;

  it("leaves the field out without an answer, as before PR-20", () => {
    expect(nextDraft(as(STATE), {})).not.toHaveProperty("questionAnswer");
    expect(nextDraft(as({ ...STATE, teacherQuestion: null }), {})).not.toHaveProperty("questionAnswer");
  });

  it("every other write keeps the held answer to the question asked now", () => {
    const held = { ...STATE, questionAnswer: ANSWER };
    expect(heldAnswer(as(held))).toEqual({ questionId: QUESTION.questionId, text: ANSWER.text });
    const body = nextDraft(as(held), { confirm: true });
    expect(body).toMatchObject({ confirm: true, questionAnswer: { questionId: QUESTION.questionId, text: ANSWER.text } });
    expect(matchesSchema(PUT_SCHEMA, body)).toBe(true);
  });

  it("an answer to an earlier question is not carried onto the new one", () => {
    const earlier = { ...STATE, questionAnswer: { ...ANSWER, questionId: OLD_QUESTION_ID } };
    expect(heldAnswer(as(earlier))).toBeUndefined();
    expect(nextDraft(as(earlier), {})).not.toHaveProperty("questionAnswer");
  });

  it("the answer's own write sets it or takes it back (null)", () => {
    expect(nextDraft(as({ ...STATE, questionAnswer: ANSWER }), { questionAnswer: null })).toMatchObject({ questionAnswer: null });
    const body = nextDraft(as(STATE), { questionAnswer: { questionId: QUESTION.questionId, text: "Izmišljeni odgovor." } });
    expect(matchesSchema(PUT_SCHEMA, body)).toBe(true);
  });
});

describe("the answer through the statement port (NF-3 PR-20)", () => {
  it("reads the question and the answer the server holds", async () => {
    const s = server(() => json(200, { ...STATE, questionAnswer: ANSWER }));
    const read = await createDeclarationStepPorts(s.call).statement.read(ASSIGNMENT);
    expect(read).toMatchObject({ kind: "ready", question: QUESTION, answer: ANSWER });
    const none = server(() => json(200, { ...STATE, teacherQuestion: undefined, questionAnswer: undefined }));
    expect(await createDeclarationStepPorts(none.call).statement.read(ASSIGNMENT)).toMatchObject({ question: null, answer: null });
  });

  it("saves the answer as the same whole-draft PUT on the version read, and takes it back", async () => {
    const s = answeringServer(STATE);
    const { statement } = createDeclarationStepPorts(s.call);
    await statement.read(ASSIGNMENT);
    expect(await statement.saveAnswer(ASSIGNMENT, { questionId: QUESTION.questionId, text: "Izmišljeni odgovor." })).toEqual({ kind: "saved" });
    const put = s.sent.find((r) => r.method === "PUT");
    expect(matchesSchema(PUT_SCHEMA, put?.body)).toBe(true);
    expect(put?.body).toMatchObject({ baseVersion: 4, revision: 2, confirm: false, questionAnswer: { questionId: QUESTION.questionId, text: "Izmišljeni odgovor." } });
    expect(await statement.read(ASSIGNMENT)).toMatchObject({ answer: { text: "Izmišljeni odgovor." } });

    // The help is saved later: the answer goes along unchanged.
    await statement.saveHumanHelp(ASSIGNMENT, { kind: "none", text: "" });
    expect(s.sent.filter((r) => r.method === "PUT").at(-1)?.body).toMatchObject({ questionAnswer: { text: "Izmišljeni odgovor." } });

    expect(await statement.saveAnswer(ASSIGNMENT, null)).toEqual({ kind: "saved" });
    expect(s.sent.filter((r) => r.method === "PUT").at(-1)?.body).toMatchObject({ questionAnswer: null });
  });

  it("a conflict, a sign-out, a refusal and a submitted work are said, never a quiet success", async () => {
    const cases: [Response, string][] = [
      [error(409, "declaration_conflict"), "conflict"], [error(401, "unauthenticated"), "signedOut"],
      [error(422, "invalid_input"), "rejected"], [error(409, "already_submitted"), "readOnly"], [error(503, "unavailable"), "unavailable"],
    ];
    for (const [answer, kind] of cases) {
      const s = server((method) => (method === "GET" ? json(200, STATE) : answer.clone()));
      const { statement } = createDeclarationStepPorts(s.call);
      await statement.read(ASSIGNMENT);
      expect(await statement.saveAnswer(ASSIGNMENT, { questionId: QUESTION.questionId, text: "Izmišljeni odgovor." }), kind).toEqual({ kind });
    }
  });
});

describe("the teacher's read of the question (NF-5 PG-6)", () => {
  const target = { teacherTarget: () => ({ assignmentId: ASSIGNMENT, studentId: ASSIGNMENT }) };

  it("gives the question and the answer beside a pending and a bound declaration", async () => {
    const pending = server(() => json(200, { state: "none", payload: null, declarationSha256: null, question: QUESTION, questionAnswer: null }));
    expect(await createDeclarationPort(pending.call, target).readTeacher("s-1")).toEqual({ kind: "pending", question: QUESTION });
    const bound = server(() => json(200, { state: "bound", declarationSha256: "b".repeat(64), question: QUESTION, questionAnswer: ANSWER, payload: {
      declarationSchema: "ductura-declaration-v1", declarationId: "d1000000-0000-4000-8000-000000000001", declarationVersion: 1,
      principalId: ASSIGNMENT, assignmentId: ASSIGNMENT, assignmentVersion: 1, documentId: "izmisljeni-dokument-1", revision: 3,
      form: FORM, ownWork: { confirmed: true }, humanHelp: { received: false, entries: [] },
      ai: { use: "not_used", declaredTools: [], recorded: [], attachments: [] },
      confirmedAt: "2026-11-20T10:00:00.000000Z",
    } }));
    expect(await createDeclarationPort(bound.call, target).readTeacher("s-1")).toEqual({
      kind: "no_use", confirmedAt: "2026-11-20T10:00:00.000000Z", question: QUESTION, answer: ANSWER,
    });
  });

  it("a read without a question carries no question fields", async () => {
    const none = server(() => json(200, { state: "none", payload: null, declarationSha256: null }));
    expect(await createDeclarationPort(none.call, target).readTeacher("s-1")).toEqual({ kind: "pending" });
  });
});
