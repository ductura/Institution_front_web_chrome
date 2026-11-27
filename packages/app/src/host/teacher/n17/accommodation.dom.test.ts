// @vitest-environment jsdom
// F4-PM2-R08 (M2.9, D-50): N-17 shows the approved accommodation mark next to the student, the mark only and
// never a reason; marks that could not be read are said once, never shown as unmarked. Invented people only.
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { joinRows, type N17Card, type N17Port, type N17Row } from "./model";
import { n17Messages as text } from "./messages.hr";

vi.mock("../../context", () => ({ useHost: () => ({ base: "/aplikacija" }) }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const DUE = "2026-12-15T22:59:00.000Z";
const row = (studentId: string, name: string, extra: Partial<N17Row> = {}): N17Row => ({
  studentId, name, group: null, submitted: false, requestedMinute: null, afterDeadline: false, evidenceRecord: null, ...extra,
});
const card = (rows: readonly N17Row[], extra: Partial<N17Card> = {}): N17Card => ({
  assignmentId: "a1", title: "Kućno kompostiranje", courseName: "Izmišljeni kolegij", dueAt: DUE, rows, ...extra,
});

let root: Root | null = null;
let host: HTMLElement | null = null;
afterEach(() => { act(() => root?.unmount()); host?.remove(); root = null; host = null; });

async function show(cards: readonly N17Card[]): Promise<HTMLElement> {
  const { default: N17Overview } = await import("./Overview");
  const port: N17Port = { read: async () => ({ kind: "ready", cards }) };
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () => { root!.render(h(N17Overview, { port })); });
  return host;
}

describe("N-17 accommodation mark (F4-PM2-R08)", () => {
  it("joins the mark to its student and leaves it absent when the marks were not read", () => {
    const rows = [row("s1", "Ana Izmišljenić"), row("s2", "Iva Izmišljenić")];
    const [ana, iva] = joinRows(rows, { dueAt: DUE, works: null, submissions: null, extensions: null, accommodations: new Map([["s1", true], ["s2", false]]) }, 0);
    expect(ana!.accommodation).toBe(true);
    expect(iva!.accommodation).toBe(false);
    const unread = joinRows(rows, { dueAt: DUE, works: null, submissions: null, extensions: null, accommodations: null }, 0);
    expect(unread.every((r) => !("accommodation" in r))).toBe(true);
  });

  it("shows the mark only next to the marked student", async () => {
    const page = await show([card([row("s1", "Ana Izmišljenić", { accommodation: true }), row("s2", "Iva Izmišljenić", { accommodation: false })])]);
    const cells = [...page.querySelectorAll("tbody tr")].map((tr) => tr.querySelector("td")!.textContent);
    expect(cells).toEqual([`Ana Izmišljenić ${text.accommodation}`, "Iva Izmišljenić"]);
    expect(page.textContent).not.toContain(text.accommodationsUnavailable);
  });

  it("says once that the marks are unavailable, and marks no one", async () => {
    const page = await show([card([row("s1", "Ana Izmišljenić"), row("s2", "Iva Izmišljenić")], { accommodationsUnavailable: true })]);
    expect(page.textContent!.split(text.accommodationsUnavailable).length - 1).toBe(1);
    expect(page.textContent).not.toContain(text.accommodation);
  });
});
