import { describe, expect, it } from "vitest";

import { decideSuggestion, decisionsFor, listSuggestions } from "@/components/editor/suggestions";
import { createTextAnchor } from "../../../../../editor-core/src/document/collaboration";
import { findForbiddenTerms } from "../../../../../../scripts/forbidden-terms/terms.ts";
import { teacherProposalsMessages } from "./messages.hr";
import { orderedProposals, proposalsStatus, withdrawToast } from "./model";
import { proposalsPort } from "./port";

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
  it("the real port answers nothing, so the panel says unavailable", async () => {
    const out = await listSuggestions(proposalsPort, "d");
    expect(out).toEqual({ kind: "unavailable" });
    expect(proposalsStatus(out, 0)).toBe(teacherProposalsMessages.unavailable);
    expect(proposalsStatus({ kind: "ok", suggestions: [] }, 0)).toBe(teacherProposalsMessages.empty);
  });
  it("keeps the order of making", () => {
    expect(orderedProposals([{ number: 2 }, { number: 1 }] as never).map((s) => s.number)).toEqual([1, 2]);
  });
  it("uses no forbidden term", () => {
    expect(findForbiddenTerms(Object.values(teacherProposalsMessages).join(" "), "hr")).toEqual([]);
  });
});
