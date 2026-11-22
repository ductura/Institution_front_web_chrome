import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { ProcessSummaryV1 } from "../../../../../../../src/client/process-summary.ts";

import { summaryText as t } from "./messages.hr";
import NoteForm from "./NoteForm";
import { durationText, noteText, panelSections } from "./panel-model";
import SummaryPanel, { type SummaryPanelProps } from "./SummaryPanel";

// Invented record: two sessions, one paste above the threshold, one gap.
const SUMMARY: ProcessSummaryV1 = {
  summaryFormat: "ductus-process-summary-v1",
  sessions: { evidenceKind: "observed", breakAboveMinutes: 30, count: 2, items: [
    { from: "2026-10-20T16:05:00.000Z", to: "2026-10-20T17:40:00.000Z" },
    { from: "2026-11-05T18:00:00.000Z", to: "2026-11-05T20:05:00.000Z" },
  ] },
  pastes: { evidenceKind: "observed", listedAboveCharacters: 200, smallerCount: 3, listed: [
    { at: { from: "2026-10-20T16:30:00.000Z", to: "2026-10-20T16:35:00.000Z" }, characters: 640, origin: "not_observed" },
  ] },
  gaps: { evidenceKind: "observed", items: [{ previousEndedAt: "2026-10-20T17:40:00.000Z", nextStartedAt: "2026-11-05T18:00:00.000Z" }] },
  recordState: "has_gaps",
};
const COMPLETE: ProcessSummaryV1 = { ...SUMMARY, gaps: { evidenceKind: "observed", items: [] }, recordState: "complete" };

describe("panelSections", () => {
  it("before the submission: the intro, the range so far and the note hint beside a gap", () => {
    const s = panelSections(SUMMARY, { submitted: false });
    expect(s.intro).toBe(t.beforeSubmit);
    expect(s.period).toEqual({ kind: "rows", rows: [{ label: "Do sada", value: "20. listopada 2026. do 5. studenoga 2026." }] });
    expect(s.sessions.value).toBe("2 sesije");
    expect(s.sessions.meta).toBe("Sesija je niz promjena bez prekida duljeg od 30 minuta (prag P-01, postavka fakulteta). Raspon praznine nije uračunat.");
    expect(s.sessions.list).toEqual(["20. listopada 2026., 18:05 do 19:40", "5. studenoga 2026., 19:00 do 21:05"]);
    expect(s.editing).toEqual({ label: "Zbroj trajanja 2 sesije", value: "3 h 40 min" });
    expect(s.pastes.items).toEqual(["20. listopada 2026., 18:30 do 18:35 · 640 znakova"]);
    expect(s.pastes.meta).toContain("dulje od 200 znakova (prag P-02, postavka fakulteta)");
    expect(s.pastes.meta).toContain("Bez zbroja i bez udjela u radu.");
    expect(s.gaps.items).toEqual([expect.stringMatching(/^Od verzije 20\. listopada 2026\. u 19:40 do verzije 5\. studenoga 2026\. u 19:00\. /)]);
    expect(s.gaps.hint).toBe(t.gaps.noteHint);
    expect(s.record).toEqual({ state: t.record.hasGaps, unchanged: undefined });
  });

  it("after the submission: first and last event, no hint, the record unchanged since it arrived", () => {
    const s = panelSections(COMPLETE, { submitted: true });
    expect(s.intro).toBeUndefined();
    expect(s.period).toEqual({ kind: "rows", rows: [
      { label: t.period.first, value: "20. listopada 2026. u 18:05" },
      { label: t.period.last, value: "5. studenoga 2026. u 21:05" },
    ] });
    expect(s.sessions.meta).not.toContain(t.sessions.gapNotCounted.trim());
    expect(s.gaps).toEqual({ items: [], hint: undefined });
    expect(s.record).toEqual({ state: t.record.complete, unchanged: t.record.unchanged });
  });

  it("a record with no session says so instead of a range", () => {
    const empty = { ...COMPLETE, sessions: { ...COMPLETE.sessions, count: 0, items: [] } };
    expect(panelSections(empty, { submitted: false }).period).toEqual({ kind: "none", text: t.period.none });
    expect(panelSections(empty, { submitted: false }).editing.value).toBe("0 min");
  });

  it("formats durations and notes as the prototype does", () => {
    expect(durationText(485)).toBe("8 h 05 min");
    expect(durationText(45)).toBe("45 min");
    expect(noteText({ id: "n-1", text: "Izmišljena napomena", createdAt: "2026-11-01T10:00:00.000Z" }))
      .toBe("Izmišljena napomena · 1. studenoga 2026. u 11:00");
  });
});

const props = (over: Partial<SummaryPanelProps> = {}): SummaryPanelProps => ({
  summary: { kind: "ready", summary: SUMMARY },
  notes: { kind: "ready", notes: [] },
  submitted: false,
  confirmed: false,
  online: true,
  workHref: "/app/web/rad/a-1",
  onRetry: () => {},
  onAddNote: async () => ({ kind: "nepoznato" }),
  onNoteAdded: () => {},
  ...over,
});
const render = (over?: Partial<SummaryPanelProps>) => renderToStaticMarkup(h(SummaryPanel, props(over)));

describe("SummaryPanel", () => {
  it("shows all eleven sections, each source marked", () => {
    const html = render();
    for (const title of [t.period.title, t.sessions.title, t.editing.title, t.versions.title, t.pastes.title, t.assistant.title,
      t.gaps.title, t.declaration.title, t.notes.title, t.record.title, t.provenance.title]) expect(html).toContain(title);
    expect(html).toContain(t.observed);
    expect(html).toContain(t.pastes.origin);
    expect(html).toContain(`href="/app/web/rad/a-1"`);
    expect(html).toContain(t.provenance.link);
    expect(html).toContain(t.versions.unavailable);
    expect(html).toContain(t.assistant.unavailable);
  });

  it("the declaration and notes as the step has them", () => {
    expect(render()).toContain(t.declaration.missing);
    expect(render({ confirmed: true })).toContain(t.declaration.confirmed);
    expect(render()).toContain(t.notes.none);
    expect(render()).toContain(t.notes.open);
    const note = { id: "n-1", text: "Izmišljena napomena", createdAt: "2026-11-01T10:00:00.000Z" };
    const listed = render({ notes: { kind: "ready", notes: [note] } });
    expect(listed).toContain("Izmišljena napomena · 1. studenoga 2026. u 11:00");
    expect(listed).toContain(t.declared);
    expect(render({ notes: { kind: "unavailable" } })).toContain(t.notes.unavailable);
  });

  it("a submitted work has no note form and says the record is unchanged", () => {
    const html = render({ submitted: true, summary: { kind: "ready", summary: COMPLETE } });
    expect(html).not.toContain(t.notes.open);
    expect(html).not.toContain(t.beforeSubmit);
    expect(html).toContain(t.record.unchanged);
  });

  it("loading, error and unavailable never hold the step", () => {
    expect(render({ summary: { kind: "loading" } })).toContain(t.loading);
    const error = render({ summary: { kind: "error" } });
    expect(error).toContain(t.error);
    expect(error).toContain(t.retry);
    expect(error).toContain(t.notes.title);
    const unavailable = render({ summary: { kind: "unavailable" } });
    expect(unavailable).toContain(t.unavailable);
    expect(unavailable).not.toContain(t.retry);
  });
});

describe("NoteForm", () => {
  it("has the prototype's label, the 600 character limit and both buttons", () => {
    const html = renderToStaticMarkup(h(NoteForm, { online: true, onAdd: async () => ({ kind: "nepoznato" }) as const, onAdded: () => {}, onCancel: () => {} }));
    expect(html).toContain(t.notes.label);
    expect(html).toContain(`maxLength="600"`);
    expect(html).toContain(t.notes.hint);
    expect(html).toContain(t.notes.add);
    expect(html).toContain(t.notes.cancel);
  });
});
