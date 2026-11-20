import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { Schema } from "@tiptap/pm/model";
import { EditorState } from "@tiptap/pm/state";

import { createTextAnchor } from "../../../../packages/editor-core/src/document/collaboration";
import { NODE_ID_ATTRIBUTE } from "@/editor";

import { acceptanceTransaction, planAcceptance, SUGGESTION_ACCEPT_META } from "./accept";
import { SuggestionCard, decisionsFor } from "./SuggestionCard";
import { createSuggestion, decideSuggestion, listSuggestions, type Reply, type Transport } from "./suggestion-api";
import { suggestionsFromList, SUGGESTION_SOURCE } from "./suggestion";

const ID = "11111111-1111-4111-8111-111111111111";
const NODE = "22222222-2222-4222-8222-222222222222";
const TEXT = "Prvi rezultati su jasni.";
const anchor = createTextAnchor({ nodeId: NODE as never, nodeText: TEXT, start: 0, end: 14 });
const row = (over: Record<string, unknown> = {}) => ({
  id: ID, state: "pending", row_seq: 1, anchor, replacement: "Rezultati", is_own: false, opened_window: "2026-11-16T10:00:00Z", ...over,
});
const probe = (reply: Reply, seen: { path?: string; body?: unknown } = {}): Transport => async (path, body) => {
  seen.path = path; seen.body = body; return reply;
};

const schema = new Schema({
  nodes: {
    doc: { content: "paragraph+" },
    paragraph: { content: "text*", group: "block", attrs: { [NODE_ID_ATTRIBUTE]: { default: null } } },
    text: {},
  },
});
const docOf = (text: string) => schema.node("doc", null, [schema.node("paragraph", { [NODE_ID_ATTRIBUTE]: NODE }, schema.text(text))]);

describe("suggestionsFromList", () => {
  it("reads rows of exactly the documented shape", () => {
    const list = suggestionsFromList({ suggestions: [row()] });
    expect(list?.[0]).toMatchObject({ id: ID, number: 1, state: "pending", replacement: "Rezultati" });
  });
  it("rejects the whole body for an unknown field, state, duplicate or empty replacement", () => {
    expect(suggestionsFromList({ suggestions: [row({ extra: 1 })] })).toBeNull();
    expect(suggestionsFromList({ suggestions: [row({ state: "done" })] })).toBeNull();
    expect(suggestionsFromList({ suggestions: [row(), row()] })).toBeNull();
    expect(suggestionsFromList({ suggestions: [row({ replacement: "" })] })).toBeNull();
    expect(suggestionsFromList({})).toBeNull();
  });
});

describe("suggestion api", () => {
  it("lists through the transport and treats a bad body as unavailable", async () => {
    const seen: { path?: string } = {};
    const ok = await listSuggestions(probe({ status: 200, body: { suggestions: [row()] } }, seen), "d1");
    expect(ok.kind).toBe("ok");
    expect(seen.path).toBe("suggestions/list");
    expect(await listSuggestions(probe({ status: 200, body: { suggestions: [{}] } }), "d1")).toEqual({ kind: "unavailable" });
    expect(await listSuggestions(probe(null), "d1")).toEqual({ kind: "unavailable" });
    expect(await listSuggestions(probe({ status: 401, body: null }), "d1")).toEqual({ kind: "signedOut" });
  });
  it("sends only the id and the counter of a decision and maps the answers", async () => {
    const seen: { body?: unknown } = {};
    expect(await decideSuggestion(probe({ status: 200, body: {} }, seen), { id: ID, rowSeq: 3 }, "withdraw")).toBe("ok");
    expect(seen.body).toEqual({ suggestion_id: ID, expected_seq: 3 });
    expect(await decideSuggestion(probe({ status: 409, body: {} }), { id: ID, rowSeq: 3 }, "accept")).toBe("conflict");
    expect(await decideSuggestion(probe({ status: 403, body: {} }), { id: ID, rowSeq: 3 }, "reject")).toBe("forbidden");
    expect(await decideSuggestion(probe(null), { id: ID, rowSeq: 3 }, "reject")).toBe("unavailable");
  });
  it("creates a suggestion with the anchor and the replacement only", async () => {
    const seen: { body?: unknown } = {};
    expect(await createSuggestion(probe({ status: 201, body: {} }, seen), "d1", anchor, "Rezultati")).toBe("ok");
    expect(Object.keys(seen.body as object).sort()).toEqual(["anchor", "document_id", "replacement"]);
  });
});

describe("acceptance", () => {
  it("replaces the anchored text only, as a student's change marked with the suggestion source", () => {
    const doc = docOf(TEXT);
    const s = suggestionsFromList({ suggestions: [row()] })![0]!;
    const plan = planAcceptance(doc, s)!;
    expect(plan).toEqual({ from: 1, to: 15, insert: "Rezultati" });
    const state = EditorState.create({ doc });
    const tr = acceptanceTransaction(state, plan, s.id);
    expect(tr.doc.textContent).toBe("Rezultati su jasni.");
    expect(tr.getMeta(SUGGESTION_ACCEPT_META)).toEqual({ suggestionId: ID, source: SUGGESTION_SOURCE });
    expect(state.doc.textContent).toBe(TEXT);
  });
  it("gives no change when the text moved away or the paragraph is gone", () => {
    const s = suggestionsFromList({ suggestions: [row()] })![0]!;
    expect(planAcceptance(docOf("Potpuno drugi tekst."), s)).toBeNull();
    expect(planAcceptance(docOf(`Uvod. ${TEXT}`), s)).toMatchObject({ from: 7, to: 21 });
    expect(planAcceptance(schema.node("doc", null, [schema.node("paragraph", { [NODE_ID_ATTRIBUTE]: "other" }, schema.text(TEXT))]), s)).toBeNull();
  });
});

describe("SuggestionCard", () => {
  const s = suggestionsFromList({ suggestions: [row()] })![0]!;
  const html = (viewer: "student" | "teacher", over = {}) =>
    renderToStaticMarkup(createElement(SuggestionCard, { suggestion: { ...s, ...over } as typeof s, viewer, onDecide: async () => "ok" as const }));
  it("offers accept and reject to the student, withdraw to the teacher, while pending", () => {
    expect(html("student")).toContain("Prihvati");
    expect(html("student")).toContain("Odbij");
    expect(html("student")).not.toContain("Povuci");
    expect(html("teacher")).toContain("Povuci prijedlog");
    expect(html("teacher")).not.toContain("Prihvati");
  });
  it("offers nothing once decided, and says the text was not changed on withdrawal", () => {
    for (const state of ["withdrawn", "accepted", "rejected"] as const) expect(decisionsFor("student", { state })).toEqual([]);
    expect(html("teacher", { state: "withdrawn" })).toContain("Tekst rada nije promijenjen");
    expect(html("teacher", { state: "accepted" })).toContain("prihvaćen prijedlog mentora");
  });
  it("renders text as text, never as HTML", () => {
    expect(html("student", { replacement: "<b>x</b>" })).toContain("&lt;b&gt;x&lt;/b&gt;");
  });
});
