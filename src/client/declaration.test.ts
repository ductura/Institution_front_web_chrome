// The declaration port's fake (WEB-1209): what the student may confirm and what the teacher
// then receives. Conversations the student did not attach never reach the teacher (D-41).
import { describe, expect, it } from "vitest";
import type { Attachment, StudentConversation } from "./declaration";
import { createFakeDeclaration, type FakeSubmission } from "./declaration-fake";

const required: StudentConversation = {
  conversationId: "c-required",
  title: "Razgovor 1 · Lektura",
  reason: "transfer",
  requiredBecause: "Odlomak 2 prenesen je u rad.",
  assistantName: "Asistent",
  throughSeq: 2,
  messagesSha256: "a".repeat(64),
  turns: [
    { seq: 1, author: "student", text: "Izmišljeno pitanje." },
    { seq: 2, author: "assistant", text: "Izmišljen odgovor." },
  ],
};

const optional: StudentConversation = {
  conversationId: "c-optional",
  title: "Tajni naslov koji nastavnik ne smije vidjeti",
  reason: "student_added",
  assistantName: "Asistent",
  throughSeq: 1,
  messagesSha256: "b".repeat(64),
  turns: [{ seq: 1, author: "student", text: "Izmišljena bilješka." }],
};

const submission: FakeSubmission = {
  assistantAllowed: true,
  uses: [{ purpose: "Lektura", provider: "Asistent", phase: "Pisanje" }],
  conversations: [required, optional],
  confirmedAt: "21. 11. 10:00",
};

const attach = (c: StudentConversation): Attachment => ({
  conversationId: c.conversationId,
  reason: c.reason,
  throughSeq: c.throughSeq,
  messagesSha256: c.messagesSha256,
});

describe("fake declaration", () => {
  it("shows the student every conversation and the teacher nothing before the confirmation", async () => {
    const port = createFakeDeclaration({ s1: submission });
    const read = await port.readStudent("s1");
    expect(read.kind === "ready" && read.conversations.map((c) => c.conversationId)).toEqual(["c-required", "c-optional"]);
    expect(await port.readTeacher("s1")).toEqual({ kind: "pending" });
  });

  it("refuses a confirmation that leaves out a required conversation", async () => {
    const port = createFakeDeclaration({ s1: submission });
    expect(await port.confirm("s1", [attach(optional)])).toEqual({ kind: "unavailable" });
    expect(await port.confirm("s1", [])).toEqual({ kind: "unavailable" });
    expect(await port.readTeacher("s1")).toEqual({ kind: "pending" });
  });

  it("refuses an attachment that claims a different reason or names an unknown conversation", async () => {
    const port = createFakeDeclaration({ s1: submission });
    expect(await port.confirm("s1", [attach(required), { ...attach(optional), reason: "transfer" }])).toEqual({ kind: "unavailable" });
    expect(await port.confirm("s1", [attach(required), { ...attach(optional), conversationId: "c-other" }])).toEqual({ kind: "unavailable" });
    expect(await port.confirm("s1", [attach(required), attach(required)])).toEqual({ kind: "unavailable" });
  });

  it("gives the teacher only the attached conversation, with no trace of the one left out (D-41)", async () => {
    const port = createFakeDeclaration({ s1: submission });
    expect(await port.confirm("s1", [attach(required)])).toEqual({ kind: "confirmed" });
    const teacher = await port.readTeacher("s1");
    expect(teacher.kind).toBe("ready");
    expect(teacher.kind === "ready" && teacher.conversations.map((c) => c.conversationId)).toEqual(["c-required"]);
    const wire = JSON.stringify(teacher);
    expect(wire).not.toContain(optional.conversationId);
    expect(wire).not.toContain(optional.title);
    expect(wire).not.toContain(optional.turns[0]!.text);
  });

  it("gives the teacher an optional conversation once the student picks it", async () => {
    const port = createFakeDeclaration({ s1: submission });
    await port.confirm("s1", [attach(required), attach(optional)]);
    const teacher = await port.readTeacher("s1");
    expect(teacher.kind === "ready" && teacher.conversations.map((c) => c.reason)).toEqual(["transfer", "student_added"]);
  });

  it("answers stale when a conversation moved on after the review, and accepts the new version", async () => {
    const port = createFakeDeclaration({ s1: submission });
    const reviewed = [attach(required)];
    port.touch("s1", "c-required", "c".repeat(64));
    expect(await port.confirm("s1", reviewed)).toEqual({ kind: "stale", conversationIds: ["c-required"] });
    expect(await port.readTeacher("s1")).toEqual({ kind: "pending" });

    const again = await port.readStudent("s1");
    const fresh = again.kind === "ready" ? again.conversations.find((c) => c.conversationId === "c-required")! : required;
    expect(fresh.throughSeq).toBe(3);
    expect(await port.confirm("s1", [attach(fresh)])).toEqual({ kind: "confirmed" });
  });

  it("shows the teacher turns only up to the confirmed version", async () => {
    const port = createFakeDeclaration({ s1: submission });
    await port.confirm("s1", [attach(required)]);
    port.touch("s1", "c-required", "d".repeat(64));
    const teacher = await port.readTeacher("s1");
    const c = teacher.kind === "ready" ? teacher.conversations[0]! : null;
    expect(c?.throughSeq).toBe(2);
    expect(c?.turns.map((t) => t.seq)).toEqual([1, 2]);
  });

  it("reports no use, a disabled assistant and an unknown submission", async () => {
    const port = createFakeDeclaration({
      none: { ...submission, uses: [], conversations: [] },
      off: { ...submission, assistantAllowed: false, conversations: [] },
    });
    expect(await port.readStudent("none")).toEqual({ kind: "no_use" });
    expect(await port.confirm("none", [])).toEqual({ kind: "confirmed" });
    expect(await port.readTeacher("none")).toEqual({ kind: "no_use", confirmedAt: "21. 11. 10:00" });
    expect(await port.readStudent("off")).toEqual({ kind: "ai_disabled" });
    expect(await port.readStudent("missing")).toEqual({ kind: "unavailable" });
    expect(await port.confirm("missing", [])).toEqual({ kind: "unavailable" });
    expect(await port.readTeacher("missing")).toEqual({ kind: "unavailable" });
  });
});

// ---------------------------------------------------------------------------
// The real adapter over declaration-v1 (PIL-K-IZJAVA-PORT), against a recorded transport.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { createApi } from "./api";
import { createDeclarationPort, createDeclarationSession } from "./declaration";
import contracts from "./migration-contracts.generated.json" with { type: "json" };
import { matchesSchema, type Schema } from "./schema-check";
import { createDeclarationStepPorts } from "./statement";

const ASSIGNMENT = "00000000-0000-4000-8000-0000000000a1";
const CONVERSATION = "00000000-0000-4000-8000-0000000000b1";
const PRINTOUT = "00000000-0000-4000-8000-0000000000c1";
const FORM = { formId: "test-izjava", formVersion: 1, formSha256: "a".repeat(64) };
const STATE = {
  state: "draft", submitted: false, currentRevision: 2, version: 4, formText: "Izmišljeni obrazac.",
  currentForm: { ...FORM, text: "Izmišljeni obrazac." },
  draft: {
    baseVersion: 3, revision: 2, form: FORM, ownWork: { confirmed: false },
    humanHelp: { received: true, entries: [{ kind: "language", text: "Izmišljena lektura." }] },
    ai: { use: "used", declaredTools: [{ toolLabel: "Izmišljeni alat", purposeText: "Lektura", phaseText: "Pisanje" }], attachments: [], externalAttachmentIds: [PRINTOUT] },
    confirm: false,
  },
  payload: null, declarationSha256: null, uploads: [],
};
const DRAFT_SCHEMA = (contracts["student.declaration.get"].responses["200"].content["application/json"].schema.properties.draft.anyOf[0]) as Schema;
const ATTACHMENT = { conversationId: CONVERSATION, reason: "transfer" as const, throughSeq: 2, messagesSha256: "c".repeat(64) };
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const error = (status: number, code: string) => json(status, { error: code, code, messageKey: "errors.x", status, requestId: "00000000-0000-4000-8000-000000000000" });

function server(answer: (method: string, body: unknown) => Response) {
  const sent: { method: string; path: string; body: unknown }[] = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    const method = init?.method ?? "GET";
    const body: unknown = typeof init?.body === "string" ? JSON.parse(init.body) : undefined;
    sent.push({ method, path: new URL(String(input)).pathname, body });
    return answer(method, body);
  };
  return { sent, call: createApi({ baseUrl: "https://ductura.example.invalid", fetchImpl }) };
}

/** A server that keeps one declaration and refuses a write on any version but the current one. */
function versionedServer() {
  let state = { ...STATE };
  return server((method, body) => {
    if (method === "GET") return json(200, state);
    const put = body as { baseVersion: number; confirm: boolean; humanHelp: typeof STATE.draft.humanHelp };
    if (put.baseVersion !== state.version) return error(409, "declaration_conflict");
    state = { ...state, version: state.version + 1, state: put.confirm ? "confirmed" : "draft", draft: { ...state.draft, humanHelp: put.humanHelp } };
    return json(200, state);
  });
}

describe("declaration adapter (PIL-K-IZJAVA-PORT)", () => {
  it("confirms with a body the contract and its draft schema accept, on the version the view read", async () => {
    const s = server((method) => (method === "GET" ? json(200, STATE) : json(200, { ...STATE, state: "confirmed", version: 5 })));
    const port = createDeclarationPort(s.call);
    await port.readStudent(ASSIGNMENT);
    expect(await port.confirm(ASSIGNMENT, [ATTACHMENT])).toEqual({ kind: "confirmed" });
    expect(s.sent.map((r) => r.method)).toEqual(["GET", "PUT"]);
    const put = s.sent[1];
    expect(put?.path).toBe(`/api/v1/student/assignments/${ASSIGNMENT}/declaration`);
    expect(matchesSchema(contracts["student.declaration.put"].body as Schema, put?.body)).toBe(true);
    expect(matchesSchema(DRAFT_SCHEMA, put?.body)).toBe(true);
    expect(put?.body).toMatchObject({
      baseVersion: 4, revision: 2, form: FORM, ownWork: { confirmed: true }, confirm: true,
      humanHelp: STATE.draft.humanHelp, ai: { use: "used", attachments: [], externalAttachmentIds: [PRINTOUT] },
    });
  });

  it("writes nothing without a read: there is no version to write on", async () => {
    const s = server(() => json(200, STATE));
    expect(await createDeclarationPort(s.call).confirm(ASSIGNMENT, [])).toEqual({ kind: "unavailable" });
    expect(s.sent).toEqual([]);
  });

  it("a 409 for the version is a conflict, never a quiet success (B-6)", async () => {
    for (const code of ["declaration_conflict", "stale_revision", "conflict"]) {
      const s = server((method) => (method === "GET" ? json(200, STATE) : error(409, code)));
      const port = createDeclarationPort(s.call);
      await port.readStudent(ASSIGNMENT);
      expect(await port.confirm(ASSIGNMENT, []), code).toEqual({ kind: "conflict" });
    }
    const stale = server((method) => (method === "GET" ? json(200, STATE) : error(409, "attachment_stale")));
    const port = createDeclarationPort(stale.call);
    await port.readStudent(ASSIGNMENT);
    expect(await port.confirm(ASSIGNMENT, [ATTACHMENT])).toEqual({ kind: "stale", conversationIds: [CONVERSATION] });
  });

  it("two views that read the same version: the second to write gets a conflict", async () => {
    const s = versionedServer();
    const first = createDeclarationStepPorts(s.call);
    const second = createDeclarationStepPorts(s.call);
    await first.statement.read(ASSIGNMENT);
    await second.declaration.readStudent(ASSIGNMENT);
    expect(await first.statement.saveHumanHelp(ASSIGNMENT, { kind: "content", text: "Izmišljena pomoć." })).toEqual({ kind: "saved" });
    expect(await second.declaration.confirm(ASSIGNMENT, [])).toEqual({ kind: "conflict" });
    // The first view writes on the version its own save returned: its confirmation goes through.
    expect(await first.declaration.confirm(ASSIGNMENT, [])).toEqual({ kind: "confirmed" });
    expect(s.sent.filter((r) => r.method === "GET")).toHaveLength(2);
  });

  it("a second click while the confirmation is on its way sends no second PUT", async () => {
    const s = versionedServer();
    const port = createDeclarationPort(s.call);
    await port.readStudent(ASSIGNMENT);
    const [a, b] = await Promise.all([port.confirm(ASSIGNMENT, []), port.confirm(ASSIGNMENT, [])]);
    expect([a, b]).toEqual([{ kind: "confirmed" }, { kind: "confirmed" }]);
    expect(s.sent.filter((r) => r.method === "PUT")).toHaveLength(1);
    // Once it is answered, the next confirmation is a new write again (on the version it returned).
    expect(await port.confirm(ASSIGNMENT, [])).toEqual({ kind: "confirmed" });
    expect(s.sent.filter((r) => r.method === "PUT")).toHaveLength(2);
  });

  it("401 is signedOut for every read; a signed-out view writes nothing", async () => {
    const s = server(() => error(401, "unauthorized"));
    const port = createDeclarationPort(s.call, { teacherTarget: () => ({ assignmentId: ASSIGNMENT, studentId: ASSIGNMENT }) });
    expect(await port.readStudent(ASSIGNMENT)).toEqual({ kind: "signedOut" });
    expect(await port.readTeacher("s-1")).toEqual({ kind: "signedOut" });
    const session = createDeclarationSession();
    session.states.set(ASSIGNMENT, STATE as never);
    expect(await createDeclarationPort(s.call, { session }).confirm(ASSIGNMENT, [])).toEqual({ kind: "signedOut" });
  });

  it("reads the declared tools, and the teacher's bound declaration with its printouts", async () => {
    const s = server(() => json(200, STATE));
    expect(await createDeclarationPort(s.call).readStudent(ASSIGNMENT))
      .toEqual({ kind: "ready", uses: [{ purpose: "Lektura", provider: "Izmišljeni alat", phase: "Pisanje" }], conversations: [] });
    const none = server(() => json(200, { state: "none", payload: null, declarationSha256: null }));
    const target = { teacherTarget: () => ({ assignmentId: ASSIGNMENT, studentId: ASSIGNMENT }) };
    expect(await createDeclarationPort(none.call, target).readTeacher("s-1")).toEqual({ kind: "pending" });
    expect(none.sent[0]?.path).toBe(`/api/v1/teacher/assignments/${ASSIGNMENT}/students/${ASSIGNMENT}/declaration`);
    expect(await createDeclarationPort(none.call).readTeacher("s-1")).toEqual({ kind: "unavailable" });
    const bound = server(() => json(200, { state: "bound", declarationSha256: "b".repeat(64), payload: {
      declarationSchema: "ductura-declaration-v1", declarationId: "d1000000-0000-4000-8000-000000000001", declarationVersion: 1,
      principalId: ASSIGNMENT, assignmentId: ASSIGNMENT, assignmentVersion: 1, documentId: "izmisljeni-dokument-1", revision: 3,
      form: FORM, ownWork: { confirmed: true }, humanHelp: { received: false, entries: [] },
      ai: { use: "used", declaredTools: STATE.draft.ai.declaredTools, recorded: [], attachments: [
        { externalAttachmentId: PRINTOUT, format: "application/pdf", byteLength: 10, contentSha256: "d".repeat(64), reason: "external_upload" },
      ] },
      confirmedAt: "2026-11-20T10:00:00.000000Z",
    } }));
    expect(await createDeclarationPort(bound.call, target).readTeacher("s-1")).toMatchObject({
      kind: "ready", external: [{ id: PRINTOUT, title: `${PRINTOUT}.pdf` }],
    });
  });

  it("declaration-fake.ts stays for tests and the catalogue: no app source imports it", () => {
    const root = fileURLToPath(new URL("../../", import.meta.url));
    const found: string[] = [];
    const walk = (dir: string): void => {
      for (const name of readdirSync(dir)) {
        if (name === "node_modules" || name === "dist" || name.startsWith(".")) continue;
        const path = join(dir, name);
        if (statSync(path).isDirectory()) walk(path);
        else if (/\.(?:ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) && /["'][^"'\n]*declaration-fake(?:\.ts)?["']/.test(readFileSync(path, "utf8"))) found.push(relative(root, path));
      }
    };
    for (const dir of ["src", "packages/app/src"]) walk(join(root, dir));
    expect(found).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// PIL-K-IZJAVA-VRATA: whether steps 3 and 4 may send is read only from the server.
import { declarationGateFrom, readDeclarationGate } from "./declaration";

/** An invented declaration confirmed for revision 2, as student.declaration.get gives it. */
const CONFIRMED_STATE = {
  ...STATE, state: "confirmed", version: 5, draft: null,
  payload: {
    declarationSchema: "ductura-declaration-v1", declarationId: "00000000-0000-4000-8000-0000000000d1", declarationVersion: 5,
    principalId: "00000000-0000-4000-8000-0000000000e1", assignmentId: ASSIGNMENT, assignmentVersion: 1,
    documentId: "izmisljeni-dokument-1", revision: 2, form: FORM, ownWork: { confirmed: true },
    humanHelp: { received: false, entries: [] }, ai: { use: "not_used", declaredTools: [], recorded: [], attachments: [] },
    confirmedAt: "2026-11-20T10:00:00.000000Z",
  },
  declarationSha256: "d".repeat(64),
};
const NOT_ASKED = { ...STATE, state: "none", currentForm: null, formText: null, draft: null, version: 0 };

describe("declaration gate (PIL-K-IZJAVA-VRATA)", () => {
  it("is confirmed only for a confirmed declaration of the current revision", async () => {
    const s = server(() => json(200, CONFIRMED_STATE));
    expect(await readDeclarationGate(s.call, ASSIGNMENT)).toEqual({ kind: "confirmed" });
    expect(s.sent).toEqual([{ method: "GET", path: `/api/v1/student/assignments/${ASSIGNMENT}/declaration`, body: undefined }]);
    const older = server(() => json(200, { ...CONFIRMED_STATE, currentRevision: 3 }));
    expect(await readDeclarationGate(older.call, ASSIGNMENT)).toEqual({ kind: "missing" });
  });

  it("a draft, a stale and an empty declaration of an assignment that asks for one are missing", () => {
    expect(declarationGateFrom(STATE as never)).toEqual({ kind: "missing" });
    expect(declarationGateFrom({ ...CONFIRMED_STATE, state: "stale" } as never)).toEqual({ kind: "missing" });
    expect(declarationGateFrom({ ...STATE, state: "none", draft: null } as never)).toEqual({ kind: "missing" });
  });

  it("an assignment with no form and nothing declared asks for no declaration (OD-6)", async () => {
    const s = server(() => json(200, NOT_ASKED));
    expect(await readDeclarationGate(s.call, ASSIGNMENT)).toEqual({ kind: "not_required" });
  });

  it("a failed or malformed read never opens sending", async () => {
    for (const answer of [() => error(503, "unavailable"), () => error(404, "not_found"), () => json(200, { state: "confirmed" }), () => { throw new TypeError("offline"); }]) {
      const s = server(answer);
      expect(await readDeclarationGate(s.call, ASSIGNMENT)).toEqual({ kind: "unavailable" });
    }
    expect(await readDeclarationGate(server(() => error(401, "unauthorized")).call, ASSIGNMENT)).toEqual({ kind: "signedOut" });
  });
});
