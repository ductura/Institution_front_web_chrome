import { describe, expect, it } from "vitest";

import type { ProcessSummaryV1, SummaryOutcome } from "../../../../../../../src/client/process-summary.ts";
import { addNote, readNotes } from "../../../../../../../src/client/submission.ts";

import { notesCall, readStepSummary, type ClientAnswer, type NotesClient, type StepWork, type SummaryPorts } from "./model";

const SUMMARY = { recordState: "complete" } as unknown as ProcessSummaryV1;
const ports = (work: StepWork | Error, outcome: SummaryOutcome | Error = { kind: "ok", summary: SUMMARY }) => {
  const asked: string[] = [];
  const p: SummaryPorts = {
    readWork: async () => { if (work instanceof Error) throw work; return work; },
    readSummary: async (documentId) => { asked.push(documentId); if (outcome instanceof Error) throw outcome; return outcome; },
  };
  return { p, asked };
};

describe("readStepSummary", () => {
  it("reads the summary of the document evidence.open named", async () => {
    const { p, asked } = ports({ kind: "ready", documentId: "doc-1" });
    expect(await readStepSummary("a-1", p)).toEqual({ kind: "ready", summary: SUMMARY, documentId: "doc-1" });
    expect(asked).toEqual(["doc-1"]);
  });
  it("sends an ended session to sign-in, from either read", async () => {
    expect(await readStepSummary("a-1", ports({ kind: "signIn" }).p)).toEqual({ kind: "signIn" });
    expect(await readStepSummary("a-1", ports({ kind: "ready", documentId: "d" }, { kind: "signedOut" }).p)).toEqual({ kind: "signIn" });
  });
  it("shows a work with no text as unavailable and never asks for a summary", async () => {
    const { p, asked } = ports({ kind: "empty" });
    expect(await readStepSummary("a-1", p)).toEqual({ kind: "unavailable" });
    expect(asked).toEqual([]);
  });
  it("turns every other failure into a repeatable error", async () => {
    for (const work of [{ kind: "unavailable" }, { kind: "notice" }, new Error("down")] as const) {
      expect(await readStepSummary("a-1", ports(work as StepWork | Error).p)).toEqual({ kind: "error" });
    }
    for (const outcome of [{ kind: "notFound" }, { kind: "unavailable" }, new Error("down")] as const) {
      expect(await readStepSummary("a-1", ports({ kind: "ready", documentId: "d" }, outcome as SummaryOutcome | Error).p)).toEqual({ kind: "error" });
    }
  });
});

const NOTE = { id: "n-1", text: "Izmišljena bilješka", createdAt: "2026-11-01T10:00:00.000000Z" };
const notes = (list: ClientAnswer, add: ClientAnswer) => {
  const sent: unknown[] = [];
  const client: NotesClient = {
    list: async (assignmentId) => { sent.push(["list", assignmentId]); return list; },
    add: async (assignmentId, text) => { sent.push(["add", assignmentId, text]); return add; },
  };
  return { local: notesCall(client), sent };
};

describe("notesCall", () => {
  it("lists the notes through the shared client", async () => {
    const { local, sent } = notes({ ok: true, status: 200, body: { notes: [NOTE] } }, { ok: false, status: 500 });
    expect(await readNotes(local, "a-1")).toEqual({ kind: "ready", notes: [NOTE] });
    expect(sent).toEqual([["list", "a-1"]]);
  });
  it("reads the server's new note as the note src/client expects", async () => {
    const { local, sent } = notes({ ok: false, status: 500 }, { ok: true, status: 201, body: NOTE });
    expect(await addNote(local, "a-1", "Izmišljena bilješka")).toEqual({ kind: "added", note: NOTE });
    expect(sent).toEqual([["add", "a-1", "Izmišljena bilješka"]]);
  });
  it("passes failures on with a code and rejects any other route", async () => {
    const { local } = notes({ ok: false, status: 503 }, { ok: false, status: 422, code: "invalid" });
    expect(await local("student.submission-notes.get", { params: { assignmentId: "a-1" } })).toEqual({ ok: false, status: 503, code: "unavailable" });
    expect(await local("student.submission-notes.post", { params: { assignmentId: "a-1" }, body: { assignmentId: "a-1", text: "x" } }))
      .toEqual({ ok: false, status: 422, code: "invalid" });
    expect(await local("student.submission.get" as never, { params: { assignmentId: "a-1" } } as never)).toEqual({ ok: false, status: 0, code: "client_rejected" });
  });
});
