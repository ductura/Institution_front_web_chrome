import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { LocalCall, SubmissionNote } from "@/client/submission";

import type { ProcessSummaryV1 } from "../summary/ProcessSummaryView";
import {
  BeforeSubmitView, loadNotes, pastedText, saveNote,
  type BeforeSubmitViewProps, type NotesRead, type SummaryRead,
} from "./BeforeSubmit";
import { stageOf, type Stage } from "./stage";
import { noteFailure, noteProblem } from "./NoteDialog";

// Invented summary of an invented work (no real student data).
const PASTED_WITH_GAP: ProcessSummaryV1 = {
  summaryFormat: "ductus-process-summary-v1",
  sessions: { evidenceKind: "observed", breakAboveMinutes: 30, count: 1,
    items: [{ from: "2026-11-10T09:00:00.000Z", to: "2026-11-10T10:00:00.000Z" }] },
  pastes: { evidenceKind: "observed", listedAboveCharacters: 200,
    listed: [{ at: { from: "2026-11-10T09:20:00.000Z", to: "2026-11-10T09:21:00.000Z" }, characters: 340, origin: "not_observed" }],
    smallerCount: 2 },
  gaps: { evidenceKind: "observed", items: [{ previousEndedAt: "2026-11-10T09:30:00.000Z", nextStartedAt: "2026-11-10T09:45:00.000Z" }] },
  recordState: "has_gaps",
};
const EMPTY: ProcessSummaryV1 = {
  summaryFormat: "ductus-process-summary-v1",
  sessions: { evidenceKind: "observed", breakAboveMinutes: 30, count: 0, items: [] },
  pastes: { evidenceKind: "observed", listedAboveCharacters: 200, listed: [], smallerCount: 0 },
  gaps: { evidenceKind: "observed", items: [] },
  recordState: "complete",
};
const NOTE: SubmissionNote = { id: "note-1", text: "Izmišljena napomena uz predaju.", createdAt: "2026-11-10T10:05:00.000000Z" };
const ASSIGNMENT = "00000000-0000-4000-8000-000000000025";
const nothing = () => undefined;

function render(over: Partial<BeforeSubmitViewProps> = {}): string {
  const props: BeforeSubmitViewProps = {
    summary: { kind: "ready", summary: PASTED_WITH_GAP },
    notes: { kind: "ready", notes: [] },
    stage: { kind: "open" },
    confirmed: true,
    online: true,
    onNext: nothing, onDeclaration: nothing, onBack: nothing, onReceipt: nothing, onRetry: nothing, onOpenNote: nothing,
    ...over,
  };
  return renderToStaticMarkup(<BeforeSubmitView {...props} />);
}

const button = (markup: string, label: string) => markup.match(new RegExp(`<button[^>]*>${label}</button>`))?.[0] ?? "";
const text = (markup: string) => markup.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");

describe("BeforeSubmitView (WEB-25, S: E-8)", () => {
  it("is step 3 of the submission", () => {
    const current = render().match(/<li aria-current="step">.*?<\/li>/)?.[0] ?? "";
    expect(text(current).trim()).toBe("3 Prije predaje");
  });

  it("lets a work with pastes and a gap in the record go on to step 4 (§5 rule 11)", () => {
    const markup = render();
    expect(button(markup, "Dalje na predaju")).not.toBe("");
    expect(button(markup, "Dalje na predaju")).not.toContain("disabled");
    expect(text(markup)).toContain("Lijepljenja veća od praga: 1");
    expect(text(markup)).toContain("Lijepljenja ne zaustavljaju predaju.");
  });

  it("sends an unconfirmed declaration back to step 2 instead of on", () => {
    const markup = render({ confirmed: false });
    expect(button(markup, "Dalje na predaju")).toBe("");
    expect(button(markup, "Natrag na izjavu")).not.toBe("");
    expect(text(markup)).toContain("Nije potvrđena. Predaja čeka potvrdu izjave.");
  });

  it("has the four check rows, the form check not run", () => {
    const rows = text(render().match(/<dl[^>]*>.*?<\/dl>/)?.[0] ?? "");
    for (const row of ["Izjava", "Mjesta za izvor", "Zalijepljeno (izvor nije opažen)", "Pravila oblika", "Provjera oblika još nije pokrenuta."]) {
      expect(rows).toContain(row);
    }
  });

  it("shows the process summary on the right with the record's gap", () => {
    const markup = text(render());
    expect(markup).toContain("Sažetak procesa");
    expect(markup).toContain("Zapis ima praznine");
  });

  it("an empty summary is the prazno variant and still lets the student on", () => {
    const markup = render({ summary: { kind: "ready", summary: EMPTY } });
    expect(text(markup)).toContain("Nema zabilježenih sesija.");
    expect(button(markup, "Dalje na predaju")).not.toContain("disabled");
  });

  it("a summary that cannot load does not hold the submission", () => {
    const markup = render({ summary: { kind: "error" } });
    expect(markup).toContain("Sažetak procesa trenutačno nije moguće učitati. To ne zaustavlja predaju.");
    expect(button(markup, "Dalje na predaju")).not.toContain("disabled");
    expect(button(markup, "Pokušaj ponovno")).not.toBe("");
  });

  it("shows the loading variant while the summary and the notes load", () => {
    const markup = render({ summary: { kind: "loading" }, notes: { kind: "loading" } });
    expect(markup).toContain("Učitavam sažetak procesa.");
    expect(markup).toContain('aria-busy="true"');
  });

  it("offline: Dalje and the note wait for the network", () => {
    const markup = render({ online: false });
    expect(button(markup, "Dalje na predaju")).toContain("disabled");
    expect(button(markup, "Dodaj napomenu \\(nije obavezna\\)")).toContain("disabled");
    expect(markup).toContain("Nema mreže.");
  });

  it("closed: names the passed deadline in Zagreb time", () => {
    const markup = text(render({ stage: { kind: "closed", dueAt: "2026-11-01T22:59:00.000Z" } }));
    expect(markup).toContain("Rok za predaju je prošao: 1. studenoga 2026. u 23:59.");
  });

  it("submitted: leads to the receipt, no note and no submission", () => {
    const markup = render({ stage: { kind: "submitted" } });
    expect(button(markup, "Potvrda predaje")).not.toBe("");
    expect(button(markup, "Dalje na predaju")).toBe("");
    expect(markup).not.toContain("Dodaj napomenu");
  });

  it("lists the notes as the server returned them", () => {
    expect(text(render({ notes: { kind: "ready", notes: [NOTE] } }))).toContain(NOTE.text);
    expect(render({ notes: { kind: "unavailable" } })).toContain("Napomene trenutačno nije moguće učitati.");
    expect(button(render({ notes: { kind: "unavailable" } }), "Dodaj napomenu \\(nije obavezna\\)")).toContain("disabled");
  });

  it("the unavailable stage says so", () => {
    expect(render({ stage: { kind: "unavailable" } })).toContain("Podatke o zadatku trenutačno nije moguće učitati.");
  });
});

describe("stageOf and pastedText", () => {
  const now = Date.parse("2026-11-19T12:00:00.000Z");
  it("submitted wins, then the deadline", () => {
    expect(stageOf("submitted", "2026-11-01T00:00:00.000Z", now)).toEqual<Stage>({ kind: "submitted" });
    expect(stageOf("in_progress", "2026-11-01T00:00:00.000Z", now)).toEqual<Stage>({ kind: "closed", dueAt: "2026-11-01T00:00:00.000Z" });
    expect(stageOf("in_progress", "2026-12-01T00:00:00.000Z", now)).toEqual<Stage>({ kind: "open" });
    expect(stageOf("not_started", "not a time", now)).toEqual<Stage>({ kind: "open" });
  });

  it("an unknown paste count is said, not guessed", () => {
    const read: SummaryRead = { kind: "error" };
    expect(pastedText(read)).toContain("nije moguće učitati");
  });
});

/** An invented in-memory server for the notes route (append only). */
function fakeNotes(): LocalCall {
  const kept: SubmissionNote[] = [];
  return async (id, input) => {
    if (id === "student.submission-notes.get") return { ok: true, status: 200, body: { notes: [...kept] } };
    if (id === "student.submission-notes.post" && input.body !== undefined) {
      const note = { id: `note-${kept.length + 1}`, text: input.body.text, createdAt: "2026-11-19T12:00:00.000000Z" };
      kept.push(note);
      return { ok: true, status: 201, body: { note } };
    }
    return { ok: false, status: 404, code: "not_found" };
  };
}

describe("notes (PD-4)", () => {
  it("a note added is there after a refresh (a new read)", async () => {
    const local = fakeNotes();
    const added = await saveNote(local, ASSIGNMENT, "Izmišljena napomena.");
    expect(added.kind).toBe("added");
    expect(await loadNotes(local, ASSIGNMENT)).toEqual<NotesRead>({
      kind: "ready", notes: [{ id: "note-1", text: "Izmišljena napomena.", createdAt: "2026-11-19T12:00:00.000000Z" }],
    });
  });

  it("blank and too long notes are not sent", async () => {
    let calls = 0;
    const local: LocalCall = async () => { calls += 1; return { ok: false, status: 500, code: "unexpected" }; };
    expect((await saveNote(local, ASSIGNMENT, "   ")).kind).toBe("greska");
    expect((await saveNote(local, ASSIGNMENT, "a".repeat(601))).kind).toBe("greska");
    expect(calls).toBe(0);
    expect(noteProblem("  ")).toBe("Upišite napomenu ili odustanite.");
    expect(noteProblem("a".repeat(601))).toBe("Napomena može imati najviše 600 znakova.");
    expect(noteProblem("a".repeat(600))).toBeUndefined();
  });

  it("without the route the notes are unavailable and nothing is said to be added", async () => {
    expect(await loadNotes(undefined, ASSIGNMENT)).toEqual<NotesRead>({ kind: "unavailable" });
    const result = await saveNote(undefined, ASSIGNMENT, "Izmišljena napomena.");
    expect(result.kind).toBe("nepoznato");
    expect(noteFailure(result)).toContain("Nije potvrđeno je li napomena dodana.");
  });

  it("a session that ended is named", () => {
    expect(noteFailure({ kind: "session-expired" })).toContain("AAI@EduHr");
  });
});
