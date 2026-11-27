import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

import { createApi } from "../../../../../../../src/client/api.ts";
import { attachedCountReader } from "./attached-count";
import { createStepPorts, type StepRead } from "./step-ports";

// F4-PRE-R02: Asistent conversations attached to the declaration on declaration-v2, against a recorded
// transport. Invented data only. The v2 operations are not in the extract yet (TODO(ugovor)), so the fake
// answers them by operation id, as the client will once it knows them.
const ASSIGNMENT = "00000000-0000-4000-8000-0000000000a1";
const C1 = "00000000-0000-4000-8000-0000000000c1";
const C2 = "00000000-0000-4000-8000-0000000000c2";
const H = (c: string) => c.repeat(64);
const FORM = { formId: "test-izjava", formVersion: 1, formSha256: "a".repeat(64) };
const DRAFT = {
  baseVersion: 3, revision: 2, form: FORM, ownWork: { confirmed: false },
  humanHelp: { received: false, entries: [] },
  ai: { use: "used", declaredTools: [{ toolLabel: "Asistent", purposeText: "Sažetak", phaseText: "Istraživanje" }], attachments: [] as unknown[], externalAttachmentIds: [] },
  confirm: false,
};
const STATE = {
  state: "draft", submitted: false, currentRevision: 2, version: 4, formText: "Izmišljeni obrazac.",
  currentForm: { ...FORM, text: "Izmišljeni obrazac." }, draft: DRAFT, payload: null, declarationSha256: null, uploads: [],
  declarationRequired: true, teacherQuestion: null, questionAnswer: null,
};
const CONVERSATIONS = [
  // Out of order on purpose: the step numbers them oldest first.
  { conversationId: C2, purposeKey: "summary", createdAt: "2026-11-20T10:00:00.000Z", requestCount: 1, lastActivityAt: "2026-11-20T10:05:00.000Z" },
  { conversationId: C1, purposeKey: "summary", createdAt: "2026-11-18T09:00:00.000Z", requestCount: 1, lastActivityAt: "2026-11-18T09:02:00.000Z" },
];
const MESSAGES = {
  [C1]: [
    { seq: 2, id: "m2", requestId: "r1", role: "provider_response", content: "Izmišljeni odgovor.", contentSha256: H("b"), createdAt: "2026-11-18T09:01:00.000Z", requestState: "completed" },
    { seq: 1, id: "m1", requestId: "r1", role: "student_paragraph", content: "Izmišljeni odlomak.", contentSha256: H("a"), createdAt: "2026-11-18T09:00:30.000Z", requestState: "completed" },
  ],
  [C2]: [
    { seq: 1, id: "m3", requestId: "r2", role: "student_paragraph", content: "Drugi odlomak.", contentSha256: H("c"), createdAt: "2026-11-20T10:00:30.000Z", requestState: "completed" },
  ],
} as const;

type Answer = { ok: true; status: number; body: unknown } | { ok: false; status: number; code: string };
type Body = typeof DRAFT & { baseVersion: number; confirm: boolean };

/** A v2 server: one declaration whose draft keeps the attachments of the last accepted write. */
function v2Server(opts: { putAnswer?: (body: Body) => Answer | null; conversations?: Answer } = {}) {
  let state = { ...STATE, draft: { ...DRAFT, ai: { ...DRAFT.ai } } };
  const sent: { op: string; body?: Body }[] = [];
  const ok = (body: unknown): Answer => ({ ok: true, status: 200, body });
  const call = async (op: string, input: { params: Record<string, string>; body?: unknown }): Promise<Answer> => {
    sent.push({ op, body: input.body as Body | undefined });
    switch (op) {
      case "student.declaration-second.get": return ok(state);
      case "student.declaration-second.put": {
        const body = input.body as Body;
        const given = opts.putAnswer?.(body);
        if (given) return given;
        if (body.baseVersion !== state.version) return { ok: false, status: 409, code: "declaration_conflict" };
        state = { ...state, version: state.version + 1, state: body.confirm ? "confirmed" : "draft", draft: { ...body, baseVersion: state.version } };
        return ok(state);
      }
      case "student.assistant-conversations.get": return opts.conversations ?? ok({ assignmentId: ASSIGNMENT, conversations: CONVERSATIONS });
      case "student.assistant-conversation.get": {
        const messages = MESSAGES[input.params.conversationId as keyof typeof MESSAGES];
        return messages ? ok({ conversationId: input.params.conversationId, messages }) : { ok: false, status: 404, code: "not_found" };
      }
      default: return { ok: false, status: 404, code: "not_found" };
    }
  };
  return { sent, state: () => state, ports: createStepPorts(call as unknown as ReturnType<typeof createApi>), call };
}

function shown(read: StepRead) {
  if (read.kind !== "read" || read.view.kind !== "ready") throw new Error(`expected a ready read, got ${read.kind}`);
  return read.view;
}

const expectedHash = (hashes: string[]) => createHash("sha256").update(`[${hashes.map((h) => `"${h}"`).join(",")}]`).digest("hex");

describe("conversations on the declaration (F4-PRE-R02, declaration-v2)", () => {
  it("lists the conversations oldest first, none attached and none required before a write", async () => {
    const s = v2Server();
    const view = shown(await s.ports.read(ASSIGNMENT));
    expect(view.chats.map((c) => ({ n: c.n, id: c.conversationId, attached: c.attached, required: c.required, date: c.date }))).toEqual([
      { n: 1, id: C1, attached: false, required: false, date: expect.stringMatching(/^18\. ?11\. ?2026\.?$/) },
      { n: 2, id: C2, attached: false, required: false, date: expect.stringMatching(/^20\. ?11\. ?2026\.?$/) },
    ]);
    expect(s.sent.filter((r) => r.op.startsWith("student.declaration")).map((r) => r.op)).toEqual(["student.declaration-second.get"]);
  });

  it("attaches a whole conversation with the hash the server checks, and keeps it on later writes", async () => {
    const s = v2Server();
    await s.ports.read(ASSIGNMENT);
    expect(await s.ports.attach!(ASSIGNMENT, C1, true)).toBe("saved");
    const ref = { conversationId: C1, throughSeq: 2, messagesSha256: expectedHash([H("a"), H("b")]) };
    const put = s.sent.find((r) => r.op === "student.declaration-second.put");
    expect(put?.body?.ai.attachments).toEqual([ref]);
    expect(put?.body?.baseVersion).toBe(4);
    // The step reads it back as attached; the statement's next write does not drop it.
    const view = shown(await s.ports.read(ASSIGNMENT));
    expect(view.chats.find((c) => c.conversationId === C1)?.attached).toBe(true);
    expect(await s.ports.statement.saveHumanHelp(ASSIGNMENT, { kind: "content", text: "Izmišljena pomoć." })).toEqual({ kind: "saved" });
    expect(s.state().draft.ai.attachments).toEqual([ref]);
    // And the confirmation carries it too.
    expect(await s.ports.confirm(ASSIGNMENT)).toBe("saved");
    expect(s.state().draft.ai.attachments).toEqual([ref]);
  });

  it("takes a conversation off without touching the others", async () => {
    const s = v2Server();
    await s.ports.read(ASSIGNMENT);
    await s.ports.attach!(ASSIGNMENT, C1, true);
    await s.ports.read(ASSIGNMENT);
    await s.ports.attach!(ASSIGNMENT, C2, true);
    await s.ports.read(ASSIGNMENT);
    expect(await s.ports.attach!(ASSIGNMENT, C1, false)).toBe("saved");
    expect((s.state().draft.ai.attachments as { conversationId: string }[]).map((a) => a.conversationId)).toEqual([C2]);
  });

  it("names a stale attachment and a version conflict; neither is shown as saved", async () => {
    const stale = v2Server({ putAnswer: () => ({ ok: false, status: 409, code: "attachment_stale" }) });
    await stale.ports.read(ASSIGNMENT);
    expect(await stale.ports.attach!(ASSIGNMENT, C1, true)).toBe("stale");
    const conflict = v2Server({ putAnswer: () => ({ ok: false, status: 409, code: "declaration_conflict" }) });
    await conflict.ports.read(ASSIGNMENT);
    expect(await conflict.ports.attach!(ASSIGNMENT, C1, true)).toBe("conflict");
    expect(conflict.state().draft.ai.attachments).toEqual([]);
  });

  it("reads a conversation's messages for PD-2, by seq", async () => {
    const s = v2Server();
    const entries = await s.ports.chat!(C1);
    expect(entries?.map((e) => [e.who, e.text])).toEqual([["you", "Izmišljeni odlomak."], ["ai", "Izmišljeni odgovor."]]);
    expect(await s.ports.chat!("00000000-0000-4000-8000-0000000000ff")).toBeNull();
  });

  it("a failed list is said so, never shown as no conversations", async () => {
    const s = v2Server({ conversations: { ok: false, status: 503, code: "unavailable" } });
    const view = shown(await s.ports.read(ASSIGNMENT));
    expect(view.chats).toEqual([]);
    expect(view.chatsUnavailable).toBe(true);
  });

  it("counts the attached conversations for steps 3 and 4", async () => {
    const s = v2Server();
    const count = attachedCountReader(s.call as unknown as ReturnType<typeof createApi>);
    expect(await count(ASSIGNMENT)).toEqual({ total: 2, attached: 0 });
    await s.ports.read(ASSIGNMENT);
    await s.ports.attach!(ASSIGNMENT, C2, true);
    expect(await count(ASSIGNMENT)).toEqual({ total: 2, attached: 1 });
  });
});

describe("before the extract has declaration-v2 (TODO(ugovor))", () => {
  const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });

  it("stays on declaration-v1, lists the conversations, offers no attaching and counts nothing", async () => {
    const urls: string[] = [];
    const fetchImpl: typeof fetch = async (input) => {
      urls.push(String(input));
      if (String(input).includes("/assistant-conversations")) return json({ assignmentId: ASSIGNMENT, conversations: CONVERSATIONS });
      return json(STATE);
    };
    const call = createApi({ baseUrl: "https://ductura.example.invalid", fetchImpl });
    const ports = createStepPorts(call);
    const view = shown(await ports.read(ASSIGNMENT));
    expect(view.chats.map((c) => [c.n, c.conversationId, c.attached])).toEqual([[1, C1, null], [2, C2, null]]);
    expect(urls.some((u) => u.includes("declaration-v2"))).toBe(false);
    expect(await ports.attach!(ASSIGNMENT, C1, true)).toBe("unavailable");
    expect(await attachedCountReader(call)(ASSIGNMENT)).toBeNull();
  });
});
