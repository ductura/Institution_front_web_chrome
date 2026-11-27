import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AssistantChatView } from "./AssistantChat";
import {
  SHOWN,
  PURPOSE_CATALOG_VERSION, SUMMARY_MIN_WORDS, SUMMARY_PURPOSE, summaryOnlyOf, wordCount, askablePurposes, createAssistantPort, exchangesOf, heldChat, keepConversation, keptConversations, mergeConversations, requestsLeft, titleOf,
  type AssistantPort, type Message,
} from "./assistant-chat";
import { assistantChatHr } from "./messages.hr";

const ASSIGNMENT = "0f0e0d0c-0b0a-4908-8706-050403020100";
const CONV = "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d";
const REQ = "2b3c4d5e-6f7a-4b8c-9d0e-1f2a3b4c5d6e";
const RESP = "3c4d5e6f-7a8b-4c9d-8e1f-2a3b4c5d6e7f";
const SCOPE = "a".repeat(64);
const OTHER = "b".repeat(64);
const input = { assignmentId: ASSIGNMENT, conversationId: null, purposeKey: "proofreading" as const, paragraph: "Izmišljena rečenica." };

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

function portWith(answer: () => Response | Promise<Response>) {
  const sent: { body: unknown; key: string }[] = [];
  const port = createAssistantPort(async (body, key) => {
    sent.push({ body, key });
    return answer();
  }, (async () => ({ ok: false, status: 503, code: "unavailable" })) as never);
  return { port, sent };
}

function memoryStore() {
  const data = new Map<string, string>();
  return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) };
}

describe("ED-10 Asistent: asking", () => {
  it("sends the question with the catalogue version and the key, and reads a completed answer", async () => {
    const { port, sent } = portWith(() => json({ outcome: "completed", requestId: REQ, conversationId: CONV, response: { id: RESP, text: "Izmišljeni odgovor." } }));
    expect(await port.ask(input, "k-1")).toEqual({ kind: "answered", conversationId: CONV });
    expect(sent).toEqual([{ body: { ...input, purposeCatalogVersion: PURPOSE_CATALOG_VERSION }, key: "k-1" }]);
  });

  it.each([
    ["budget_exceeded", "limit"], ["ai_disabled", "disabled"], ["purpose_not_allowed", "purpose"], ["forbidden", "forbidden"],
    ["in_progress", "busy"], ["provider_failed", "failed"], ["request_outcome_unknown", "failed"], ["idempotency_conflict", "failed"],
  ])("a settled %s reads as %s", async (outcome, kind) => {
    const { port } = portWith(() => json({ outcome, requestId: null, conversationId: null }));
    expect(await port.ask(input, "k")).toEqual({ kind, conversationId: null });
  });

  it("keeps the conversation of a recorded question that got no answer", async () => {
    const { port } = portWith(() => json({ outcome: "provider_failed", requestId: REQ, conversationId: CONV }));
    expect(await port.ask(input, "k")).toEqual({ kind: "failed", conversationId: CONV });
  });

  it("a lost answer, a server error or a reply off the contract is unavailable; 401 is signed out", async () => {
    expect(await portWith(() => { throw new Error("mreža"); }).port.ask(input, "k")).toEqual({ kind: "unavailable" });
    expect(await portWith(() => json({ error: "unavailable" }, 503)).port.ask(input, "k")).toEqual({ kind: "unavailable" });
    expect(await portWith(() => json({ outcome: "completed", conversationId: CONV })).port.ask(input, "k")).toEqual({ kind: "unavailable" });
    expect(await portWith(() => json({ error: "unauthorized" }, 401)).port.ask(input, "k")).toEqual({ kind: "signedOut" });
  });
});

describe("ED-10 Asistent: the record", () => {
  const m = (seq: number, role: Message["role"], text: string): Message => ({ seq, role, text, at: "2026-11-24T10:0" + seq + ":00.000Z" });

  it("pairs every question with its answer, in order, and titles the conversation by the first question", () => {
    const messages = [m(3, "you", "Drugo pitanje"), m(1, "you", "Prvo  pitanje\nu dva retka"), m(2, "assistant", "Prvi odgovor")];
    expect(exchangesOf(messages).map((e) => [e.question.text, e.answer?.text ?? null]))
      .toEqual([["Prvo  pitanje\nu dva retka", "Prvi odgovor"], ["Drugo pitanje", null]]);
    expect(titleOf([...messages].sort((a, b) => a.seq - b.seq))).toBe("Prvo pitanje u dva retka");
  });

  it("reads a conversation from the server", async () => {
    const call = (async () => ({ ok: true, status: 200, body: { conversationId: CONV, messages: [
      { seq: 1, id: REQ, requestId: REQ, role: "student_paragraph", content: "Pitanje", contentSha256: "a".repeat(64), createdAt: "2026-11-24T10:00:00.000Z", requestState: "completed" },
      { seq: 2, id: RESP, requestId: REQ, role: "provider_response", content: "Odgovor", contentSha256: "b".repeat(64), createdAt: "2026-11-24T10:00:05.000Z", requestState: "completed" },
    ] } })) as never;
    const port = createAssistantPort(async () => json({}), call);
    expect(await port.read(CONV)).toEqual({ kind: "ok", messages: [
      { seq: 1, role: "you", text: "Pitanje", at: "2026-11-24T10:00:00.000Z" },
      { seq: 2, role: "assistant", text: "Odgovor", at: "2026-11-24T10:00:05.000Z" },
    ] });
    expect(await port.read("nije-id")).toEqual({ kind: "unavailable" });
  });

  it("keeps conversation ids per person and assignment, once, and survives a damaged store", () => {
    const store = memoryStore();
    keepConversation(SCOPE, ASSIGNMENT, { id: CONV, purposeKey: "proofreading" }, store);
    keepConversation(SCOPE, ASSIGNMENT, { id: CONV, purposeKey: "proofreading" }, store);
    expect(keptConversations(SCOPE, ASSIGNMENT, store)).toEqual([{ id: CONV, purposeKey: "proofreading" }]);
    expect(keptConversations(SCOPE, REQ, store)).toEqual([]);
    // Another person signed in on the same device does not see them.
    expect(keptConversations(OTHER, ASSIGNMENT, store)).toEqual([]);
    store.setItem(`ductura.asistent.razgovori.${SCOPE}.${ASSIGNMENT}`, "{pokvareno");
    expect(keptConversations(SCOPE, ASSIGNMENT, store)).toEqual([]);
    expect(keptConversations(SCOPE, ASSIGNMENT, null)).toEqual([]);
  });

  it("keeps only the last SHOWN conversations, so every one shown is read", () => {
    const store = memoryStore();
    const ids = Array.from({ length: SHOWN + 3 }, (_, i) => `${String(i).padStart(8, "0")}-0000-4000-8000-000000000000`);
    for (const id of ids) keepConversation(SCOPE, ASSIGNMENT, { id, purposeKey: "proofreading" }, store);
    expect(keptConversations(SCOPE, ASSIGNMENT, store).map((k) => k.id)).toEqual(ids.slice(-SHOWN));
  });

  it("with blocked or full storage the held list keeps every conversation already on the card", () => {
    const second = "4d5e6f7a-8b9c-4d0e-8f1a-2b3c4d5e6f7a";
    const blocked = { getItem: () => { throw new Error("blokirano"); }, setItem: () => { throw new Error("blokirano"); } };
    const first = keepConversation(SCOPE, ASSIGNMENT, { id: CONV, purposeKey: "proofreading" }, blocked, []);
    expect(keepConversation(SCOPE, ASSIGNMENT, { id: second, purposeKey: "formatting" }, blocked, first).map((k) => k.id)).toEqual([CONV, second]);
    // A write that fails once: the next update still starts from what the card holds, not from storage.
    let fail = true;
    const store = memoryStore();
    const flaky = { getItem: store.getItem, setItem: (k: string, v: string) => { if (fail) throw new Error("puno"); store.setItem(k, v); } };
    const held = keepConversation(SCOPE, ASSIGNMENT, { id: CONV, purposeKey: "proofreading" }, flaky, []);
    fail = false;
    expect(keepConversation(SCOPE, ASSIGNMENT, { id: second, purposeKey: "formatting" }, flaky, held).map((k) => k.id)).toEqual([CONV, second]);
    expect(keptConversations(SCOPE, ASSIGNMENT, store).map((k) => k.id)).toEqual([CONV, second]);
  });

  it("the held chat outlives the card per person and assignment, and is the same slot on reopening", () => {
    const slot = heldChat(SCOPE, ASSIGNMENT);
    slot.draft = "Nedovršeno izmišljeno pitanje";
    slot.pendingKey = "k-1";
    expect(heldChat(SCOPE, ASSIGNMENT)).toBe(slot);
    expect(heldChat(OTHER, ASSIGNMENT)).toEqual({ kept: null, current: null, purpose: "", draft: "", pendingKey: null });
  });

  it("offers only the purposes the notice allows, never transcription", () => {
    expect(askablePurposes(["translation", "transcription", "formatting"])).toEqual(["formatting", "translation"]);
    expect(askablePurposes([])).toEqual([]);
  });
});

describe("F4-EDI-R08 Asistent: samo sažimanje", () => {
  it("counts only a literal true", () => {
    expect(summaryOnlyOf({ aiSummaryOnly: true })).toBe(true);
    expect(summaryOnlyOf({ aiSummaryOnly: false })).toBe(false);
    expect(summaryOnlyOf({ aiSummaryOnly: "true" })).toBe(false);
    expect(summaryOnlyOf({})).toBe(false);
    expect(summaryOnlyOf(null)).toBe(false);
  });
  it("counts words and asks under the summarising purpose", () => {
    expect(wordCount("  ")).toBe(0);
    expect(wordCount("jedna  dvije\ntri")).toBe(3);
    expect(SUMMARY_MIN_WORDS).toBe(8);
    expect(SUMMARY_PURPOSE).toBe("literature_search");
  });
});

describe("ED-10 Asistent: the card", () => {
  const idle: AssistantPort = {
    ask: async () => ({ kind: "unavailable" }), read: async () => ({ kind: "unavailable" }),
    availability: async () => ({ kind: "unavailable" }), remaining: async () => ({ kind: "unavailable" }), conversations: async () => ({ kind: "unavailable" }),
  };
  const out = (readOnly: boolean) =>
    renderToStaticMarkup(createElement(AssistantChatView, { assignmentId: ASSIGNMENT, scope: SCOPE, readOnly, port: idle }));

  it("says who answers and what is sent, before anything is asked", () => {
    const html = out(false);
    expect(html).toContain("Odgovore daje Asistent, a ne Vi.");
    expect(html).toContain("Šalje se samo ono što upišete, ne cijeli rad.");
    expect(html).toContain(assistantChatHr.none);
    expect(html).toContain('aria-live="polite"');
  });

  it("a submitted work shows no form", () => {
    const html = out(true);
    expect(html).toContain(assistantChatHr.readOnly);
    expect(html).not.toContain("Pošalji Asistentu");
  });

  it("names no model, no provider and no simulated answers", () => {
    const text = JSON.stringify(assistantChatHr, (_k, v: unknown) => (typeof v === "function" ? String(v(2)) : v));
    expect(text).not.toMatch(/model|GPT|Claude|Gemini|OpenAI|Anthropic|simulir|izmišlj|AI\b/i);
  });
});

describe("F4-EDI-R04 Asistent: server reads", () => {
  const ok = (body: unknown) => (async () => ({ ok: true, status: 200, body })) as never;
  const fail = (status: number) => (async () => ({ ok: false, status, code: "x" })) as never;
  const throws = (async () => { throw new Error("mreža"); }) as never;
  const portOf = (call: never) => createAssistantPort(async () => json({}), call);

  it("reads availability, today's count and the conversation list, oldest first", async () => {
    expect(await portOf(ok({ assistantEnabled: false })).availability(ASSIGNMENT)).toEqual({ kind: "ok", enabled: false });
    expect(await portOf(ok({ limit: 10, used: 4 })).remaining(ASSIGNMENT)).toEqual({ kind: "ok", limit: 10, used: 4 });
    const other = "4d5e6f7a-8b9c-4d0e-8f1a-2b3c4d5e6f7a";
    const row = (conversationId: string, createdAt: string) => ({ conversationId, purposeKey: "formatting", createdAt, requestCount: 1, lastActivityAt: createdAt });
    const list = await portOf(ok({ assignmentId: ASSIGNMENT, conversations: [row(other, "2026-11-25T10:00:00.000Z"), row(CONV, "2026-11-24T10:00:00.000Z")] })).conversations(ASSIGNMENT);
    expect(list).toEqual({ kind: "ok", conversations: [{ id: CONV, purposeKey: "formatting" }, { id: other, purposeKey: "formatting" }] });
  });

  it("another person's assignment (404), signed out (401), a server error or a lost answer are told apart, never read as empty", async () => {
    for (const read of [(p: ReturnType<typeof portOf>) => p.availability(ASSIGNMENT), (p: ReturnType<typeof portOf>) => p.remaining(ASSIGNMENT), (p: ReturnType<typeof portOf>) => p.conversations(ASSIGNMENT)]) {
      expect(await read(portOf(fail(404)))).toEqual({ kind: "notFound" });
      expect(await read(portOf(fail(401)))).toEqual({ kind: "signedOut" });
      expect(await read(portOf(fail(503)))).toEqual({ kind: "unavailable" });
      expect(await read(portOf(throws))).toEqual({ kind: "unavailable" });
    }
  });

  it("counts what is left and never goes below zero; no limit means no count", () => {
    expect(requestsLeft({ kind: "ok", limit: 10, used: 4 })).toBe(6);
    expect(requestsLeft({ kind: "ok", limit: 3, used: 5 })).toBe(0);
    expect(requestsLeft({ kind: "ok", limit: null, used: 5 })).toBeNull();
  });

  it("the server list leads and a conversation only this device knows follows it", () => {
    const a = { id: CONV, purposeKey: "formatting" }, b = { id: REQ, purposeKey: "translation" };
    expect(mergeConversations([a], [a, b])).toEqual([a, b]);
    expect(mergeConversations([], [b])).toEqual([b]);
    const many = Array.from({ length: SHOWN + 2 }, (_, i) => ({ id: `${String(i).padStart(8, "0")}-0000-4000-8000-000000000000`, purposeKey: "formatting" }));
    expect(mergeConversations(many, [])).toEqual(many.slice(-SHOWN));
  });
});
