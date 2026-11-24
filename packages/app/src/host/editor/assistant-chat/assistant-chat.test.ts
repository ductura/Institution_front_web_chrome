import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AssistantChatView } from "./AssistantChat";
import {
  SHOWN,
  PURPOSE_CATALOG_VERSION, askablePurposes, createAssistantPort, exchangesOf, keepConversation, keptConversations, titleOf,
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

  it("offers only the purposes the notice allows, never transcription", () => {
    expect(askablePurposes(["translation", "transcription", "formatting"])).toEqual(["formatting", "translation"]);
    expect(askablePurposes([])).toEqual([]);
  });
});

describe("ED-10 Asistent: the card", () => {
  const idle: AssistantPort = { ask: async () => ({ kind: "unavailable" }), read: async () => ({ kind: "unavailable" }) };
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
