// WEB-NUZ-MENTOR-1 (NF-6 MK-1): the Mentor card's mount point. Every request, text and id is invented.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { RevisionRequest } from "../../../../../../src/client/revision-requests";
import type { WorkMessage } from "../../../../../../src/client/work-messages";
import { MentorMount } from "./MentorMount";
import { abstractWords, seenAtOf, workStateOf } from "./mentor-mount";

const req = (number: number, state: RevisionRequest["state"], instruction = "Izmišljena uputa za doradu.", window = "2026-11-10T09:00:00.000Z"): RevisionRequest => ({
  id: `00000000-0000-4000-8000-00000000000${number}`, number, state, rowSeq: 1, anchor: {} as RevisionRequest["anchor"],
  versions: [{
    version: 1, instruction, requestedRevision: 1, openedIsOwn: false, openedWindow: "2026-11-01T09:00:00.000Z",
    response: state === "responded" ? { kind: "changed" as never, explanation: "Izmišljeno.", revision: 2, isOwn: true, window } : null, closed: null,
  }],
});
const msg = (senderRole: "student" | "teacher", createdAt: string): WorkMessage => ({ id: "00000000-0000-4000-8000-0000000000aa", senderRole, text: "Izmišljena poruka.", createdAt });

describe("workStateOf", () => {
  it("a submitted work is submitted whatever the requests say", () => {
    expect(workStateOf(true, null)).toEqual({ kind: "submitted", submittedAt: null });
    expect(workStateOf(true, [req(1, "open")])?.kind).toBe("submitted");
  });
  it("an unread list is unavailable, never a guessed state", () => {
    expect(workStateOf(false, null)).toBeNull();
  });
  it("no request ever: the work is with the student", () => {
    expect(workStateOf(false, [])).toEqual({ kind: "draft" });
  });
  it("open requests: revision with the count and the newest instruction", () => {
    expect(workStateOf(false, [req(1, "open", "Prva."), req(2, "reopened", "Druga.")]))
      .toEqual({ kind: "revise", due: null, mustOpen: 2, request: "Druga." });
    expect(workStateOf(false, [req(1, "open", "  ")]) ?? {}).toMatchObject({ request: null });
  });
  it("a responded request: the round waits for the mentor, sent at the newest answer", () => {
    expect(workStateOf(false, [req(1, "responded", "", "2026-11-10T09:00:00.000Z"), req(2, "responded", "", "2026-11-12T09:00:00.000Z")]))
      .toEqual({ kind: "review", round: 2, sentAt: "2026-11-12T09:00:00.000Z" });
  });
  it("only closed requests: unavailable (accepted work or a new draft cannot be told apart)", () => {
    expect(workStateOf(false, [req(1, "accepted"), req(2, "withdrawn")])).toBeNull();
  });
});

describe("seenAtOf", () => {
  it("is the person's own newest message, null when they wrote none", () => {
    const list = [msg("student", "2026-11-02T10:00:00.000Z"), msg("teacher", "2026-11-03T10:00:00.000Z"), msg("student", "2026-11-01T10:00:00.000Z")];
    expect(seenAtOf("student", list)).toBe("2026-11-02T10:00:00.000Z");
    expect(seenAtOf("teacher", list)).toBe("2026-11-03T10:00:00.000Z");
    expect(seenAtOf("student", [])).toBeNull();
  });
});

describe("abstractWords", () => {
  const doc = (blocks: [string, string][]) => ({ forEach: (fn: (n: { type: { name: string }; textContent: string }) => void) => blocks.forEach(([name, text]) => fn({ type: { name }, textContent: text })) });
  it("counts the words under the Sažetak heading up to the next heading", () => {
    expect(abstractWords(doc([["heading", "Uvod"], ["paragraph", "jedan dva"], ["heading", " sažetak "], ["paragraph", "tri četiri  pet"], ["paragraph", "šest"], ["heading", "Summary"], ["paragraph", "seven"]]))).toBe(4);
  });
  it("is 0 without the heading", () => {
    expect(abstractWords(doc([["paragraph", "Izmišljeni tekst rada."]]))).toBe(0);
  });
});

describe("MentorMount", () => {
  it("draws the whole card while reading, with the consultations inside", () => {
    const html = renderToStaticMarkup(createElement(MentorMount, { documentId: "izmisljeni-dokument-1", submitted: false, editor: null }));
    expect(html).toContain("data-mentor-card");
    expect(html).toContain("Učitavam stanje rada…");
    expect(html).toContain("data-consult-panel");
    expect(html).toContain("Kako mentor radi");
  });
  it("is mounted in the student's editor in the Mentor tab, above the round's actions", () => {
    const work = readFileSync(join(import.meta.dirname, "..", "..", "student", "work.tsx"), "utf8");
    expect(work).toMatch(/import \{ MentorMount \} from "\.\.\/editor\/right\/MentorMount"/);
    expect(work).toMatch(/work: \(\{ editor, documentId, submitted \}\) => <>\s*<MentorMount editor=\{editor\} documentId=\{documentId\} submitted=\{submitted\} \/>\s*<RevisionActionsHost /);
  });
});
