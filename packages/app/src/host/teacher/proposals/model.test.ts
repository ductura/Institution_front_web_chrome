import { describe, expect, it, vi } from "vitest";

import { decideSuggestion, decisionsFor, listSuggestions } from "@/components/editor/suggestions";
import { createTextAnchor } from "../../../../../editor-core/src/document/collaboration";
import { findForbiddenTerms } from "../../../../../../scripts/forbidden-terms/terms.ts";
import { teacherProposalsMessages } from "./messages.hr";
import { orderedProposals, proposalsStatus, withdrawToast } from "./model";
import { createProposalsPort } from "./port";

type Reply = { status: number; body: unknown };
const ID = "11111111-1111-4111-8111-111111111111";
const anchor = createTextAnchor({ nodeId: "22222222-2222-4222-8222-222222222222" as never, nodeText: "Ovaj odnos slabi.", start: 0, end: 10 });
const row = (state: string) => ({ anchor, id: ID, is_own: true, opened_window: "2026-11-03T08:15:00.000Z",
  replacement: "Taj odnos", row_seq: 2, state });
const reply = (status: number, body: unknown = {}): Reply => ({ status, body });

describe("teacher proposals", () => {
  it("reads the three states of a probe answer", async () => {
    for (const state of ["pending", "withdrawn", "accepted"]) {
      const out = await listSuggestions(async () => reply(200, { suggestions: [row(state)] }), "d");
      expect(out.kind === "ok" && out.suggestions[0]?.state).toBe(state);
    }
  });
  it("a teacher can only withdraw a pending one", async () => {
    const out = await listSuggestions(async () => reply(200, { suggestions: [row("pending")] }), "d");
    if (out.kind !== "ok") throw new Error("list");
    expect(decisionsFor("teacher", out.suggestions[0]!)).toEqual(["withdraw"]);
    expect(decisionsFor("teacher", { state: "accepted" })).toEqual([]);
  });
  it("toast only after the server confirmed a withdrawal", async () => {
    const text = "Prijedlog je povučen. Tekst rada nije promijenjen.";
    expect(withdrawToast("withdraw", await decideSuggestion(async () => reply(409), { id: ID, rowSeq: 2 }, "withdraw"), text)).toBeNull();
    expect(withdrawToast("withdraw", "ok", text)).toBe(text);
  });
  describe("the real port", () => {
    const SID = "33333333-3333-4333-8333-333333333333";
    const answer = (status: number, body?: unknown) => async () =>
      new Response(body === undefined ? null : JSON.stringify(body), { status, headers: body === undefined ? {} : { "content-type": "application/json" } });
    const cRow = (state = "pending") => ({ suggestionId: SID, anchor, text: "Taj odnos", state, isOwn: true,
      baseHash: "a".repeat(64), createdWindow: "2026-11-03T08:15:00.000Z", decidedWindow: null });
    it("lists through collaboration.suggestions-list and keeps nothing it cannot read", async () => {
      const fetchImpl = vi.fn<(u: string, i?: RequestInit) => Promise<Response>>(answer(200, { suggestions: [cRow()] }));
      const out = await listSuggestions(createProposalsPort({ baseUrl: "https://ductura.test", fetchImpl: fetchImpl as never }), "d");
      expect(out.kind === "ok" && out.suggestions[0]).toMatchObject({ id: SID, replacement: "Taj odnos", state: "pending", isOwn: true });
      expect(String(fetchImpl.mock.calls[0]![0])).toContain("/api/v1/suggestions/list");
      expect(JSON.parse(String(fetchImpl.mock.calls[0]![1]!.body))).toEqual({ documentId: "d" });
      const bad = await listSuggestions(createProposalsPort({ baseUrl: "https://ductura.test", fetchImpl: answer(200, { suggestions: [{ ...cRow(), text: 5 }] }) as never }), "d");
      expect(bad).toEqual({ kind: "unavailable" });
    });
    it("keeps a deletion suggestion (empty text) in the list", async () => {
      const port = createProposalsPort({ baseUrl: "https://ductura.test", fetchImpl: answer(200, { suggestions: [cRow(), { ...cRow(), suggestionId: "44444444-4444-4444-8444-444444444444", text: "" }] }) as never });
      const out = await listSuggestions(port, "d");
      expect(out.kind === "ok" && out.suggestions.map((s) => s.replacement)).toEqual(["Taj odnos", ""]);
    });
    it("a 200 the contract refuses is no confirmation", async () => {
      const port = createProposalsPort({ baseUrl: "https://ductura.test", fetchImpl: answer(200, {}) as never });
      expect(await decideSuggestion(port, { id: SID, rowSeq: 1 }, "accept")).toBe("unavailable");
    });
    it("maps 401, 403, 404 and 409 and never fakes a success", async () => {
      const codes: Record<number, string> = { 401: "unauthorized", 403: "forbidden", 404: "not_found", 409: "conflict" };
      const outcome = (status: number) => decideSuggestion(createProposalsPort({ baseUrl: "https://ductura.test", fetchImpl: answer(status, { error: codes[status] }) as never }), { id: SID, rowSeq: 1 }, "accept");
      expect(await outcome(401)).toBe("signedOut");
      expect(await outcome(403)).toBe("forbidden");
      expect(await outcome(409)).toBe("conflict");
      expect(await outcome(404)).toBe("unavailable");
    });
    it("reject sends only suggestionId; withdraw has no route and stays unavailable", async () => {
      const fetchImpl = vi.fn<(u: string, i?: RequestInit) => Promise<Response>>(answer(204));
      const port = createProposalsPort({ baseUrl: "https://ductura.test", fetchImpl: fetchImpl as never });
      expect(await decideSuggestion(port, { id: SID, rowSeq: 1 }, "reject")).toBe("ok");
      expect(JSON.parse(String(fetchImpl.mock.calls[0]![1]!.body))).toEqual({ suggestionId: SID });
      expect(await decideSuggestion(port, { id: SID, rowSeq: 1 }, "withdraw")).toBe("unavailable");
      expect(fetchImpl).toHaveBeenCalledTimes(1);
    });
    it("is offline-safe", async () => {
      const port = createProposalsPort({ baseUrl: "https://ductura.test", fetchImpl: (async () => { throw new TypeError("offline"); }) as never });
      expect(await listSuggestions(port, "d")).toEqual({ kind: "unavailable" });
    });
  });
  it("keeps the order of making", () => {
    expect(orderedProposals([{ number: 2 }, { number: 1 }] as never).map((s) => s.number)).toEqual([1, 2]);
  });
  it("uses no forbidden term", () => {
    expect(findForbiddenTerms(Object.values(teacherProposalsMessages).join(" "), "hr")).toEqual([]);
  });
});
