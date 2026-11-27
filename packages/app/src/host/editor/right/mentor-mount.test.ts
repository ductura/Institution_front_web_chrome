// WEB-NUZ-MENTOR-1 (NF-6 MK-1): the Mentor card's mount point. Every request, text and id is invented.
import { Schema } from "@tiptap/pm/model";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { RevisionRequest } from "../../../../../../src/client/revision-requests";
import type { WorkMessage } from "../../../../../../src/client/work-messages";
import { MentorMount } from "./MentorMount";
import { abstractWords, consentOf, reportSeen, seenAtOf, thesisShownOf, unreportedSeen, workStateOf } from "./mentor-mount";

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

describe("workStateOf with the mentor's consent (MEN-R08)", () => {
  const given = { state: "given", changedAt: "2026-11-20T09:00:00.000Z" } as const;
  it("consent given and no round running: accepted, with the consent's time", () => {
    expect(workStateOf(false, [], given)).toEqual({ kind: "accepted", consentAt: "2026-11-20T09:00:00.000Z" });
    expect(workStateOf(false, [req(1, "accepted")], given)?.kind).toBe("accepted");
  });
  it("a running round, a submission or an unread list win over the consent", () => {
    expect(workStateOf(false, [req(1, "open")], given)?.kind).toBe("revise");
    expect(workStateOf(false, [req(1, "responded")], given)?.kind).toBe("review");
    expect(workStateOf(true, [], given)?.kind).toBe("submitted");
    expect(workStateOf(false, null, given)).toBeNull();
  });
  it("no consent, a withdrawn one or an unread one is not accepted", () => {
    expect(workStateOf(false, [], { state: "none", changedAt: null })).toEqual({ kind: "draft" });
    expect(workStateOf(false, [], { state: "withdrawn", changedAt: "2026-11-21T09:00:00.000Z" })).toEqual({ kind: "draft" });
    expect(workStateOf(false, [], null)).toEqual({ kind: "draft" });
  });
});

describe("consentOf", () => {
  it("reads state and time; a failed or odd answer is null, never given", () => {
    expect(consentOf({ ok: true, body: { state: "given", changedAt: null, history: [] } })).toEqual({ state: "given", changedAt: null });
    expect(consentOf({ ok: false })).toBeNull();
    expect(consentOf({ ok: true, body: null })).toBeNull();
    expect(consentOf({ ok: true, body: { state: "yes", changedAt: null } })).toBeNull();
    expect(consentOf({ ok: true, body: { state: "given", changedAt: 5 } })).toBeNull();
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
  const schema = new Schema({ nodes: { doc: { content: "block+" }, heading: { group: "block", content: "inline*" },
    paragraph: { group: "block", content: "inline*" }, bulletList: { group: "block", content: "paragraph+" },
    hardBreak: { group: "inline", inline: true }, text: { group: "inline" } } });
  const node = ([name, text]: [string, string]) => schema.node(name, null, text === "" ? [] : [schema.text(text)]);
  const doc = (blocks: [string, string][]) => schema.node("doc", null, blocks.map(node));
  it("counts the words under the Sažetak heading up to the next heading", () => {
    expect(abstractWords(doc([["heading", "Uvod"], ["paragraph", "jedan dva"], ["heading", " sažetak "], ["paragraph", "tri četiri  pet"], ["paragraph", "šest"], ["heading", "Summary"], ["paragraph", "seven"]]))).toBe(4);
  });
  it("is 0 without the heading", () => {
    expect(abstractWords(doc([["paragraph", "Izmišljeni tekst rada."]]))).toBe(0);
  });
  it("does not glue words across a list or a hard line break (#631 review, c.7144836874)", () => {
    const list = schema.node("bulletList", null, [node(["paragraph", "jedan dva"]), node(["paragraph", "tri"])]);
    const broken = schema.node("paragraph", null, [schema.text("četiri"), schema.node("hardBreak"), schema.text("pet")]);
    const d = schema.node("doc", null, [node(["heading", "Sažetak"]), list, broken]);
    // The joined text of the list ("jedan dvatri") and of the paragraph ("četiripet") is 3 words; block by block it is 5.
    expect(abstractWords(d)).toBe(5);
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
  // ED-35 (Daniel, Ductus#2058): the student must see the working criteria; without the call the card only says "nedostupno".
  it("gives the student's consultations the read of the working criteria", () => {
    const mount = readFileSync(join(import.meta.dirname, "MentorMount.tsx"), "utf8");
    expect(mount).toMatch(/<ConsultPanel [^>]*role="student"[^>]*studentCriteriaCall=\{studentCriteriaCall\}/);
    expect(mount).toMatch(/const studentCriteriaCall: StudentCriteriaCall = \(id, input\) => createApi\(\)\(id, \{ \.\.\.input, body: undefined \}\);/);
  });
  it("is mounted in the student's editor in the Mentor tab, above the round's actions", () => {
    const work = readFileSync(join(import.meta.dirname, "..", "..", "student", "WorkEditorPage.tsx"), "utf8");
    expect(work).toMatch(/import \{ MentorMount \} from "\.\.\/editor\/right\/MentorMount"/);
    // ED-60 (Ductus#2058 c.7185479035): the teacher's direct-edit setting sits between the card and the round's actions.
    expect(work).toMatch(/work: \(\{ editor, assignmentId: id, documentId, submitted \}\) => <>\s*<MentorMount editor=\{editor\} assignmentId=\{id\} documentId=\{documentId\} submitted=\{submitted\} \/>\s*(?:\{\/\*[^]*?\*\/\}\s*)?<DirectEditSettingHost [^>]*\/>\s*<RevisionActionsHost /);
  });
});

describe("thesisShownOf: \"Završni rad\" only for a mentored work (DEMO-POP-3)", () => {
  const listed = { ok: true, body: { assignments: [{ id: "AAAA0000-0000-4000-8000-000000000001" }] } } as const;
  it("shows it for a work the student's mentored works name, whatever the case of the id", () => {
    expect(thesisShownOf(listed, "aaaa0000-0000-4000-8000-000000000001")).toBe(true);
  });
  it("hides it for a course work (a seminar) the list leaves out", () => {
    expect(thesisShownOf(listed, "bbbb0000-0000-4000-8000-000000000002")).toBe(false);
    expect(thesisShownOf({ ok: true, body: { assignments: [] } }, "bbbb0000-0000-4000-8000-000000000002")).toBe(false);
  });
  it("keeps it when the list is unread or the assignment unknown; the panel's own 404 still decides", () => {
    expect(thesisShownOf({ ok: false }, "bbbb0000-0000-4000-8000-000000000002")).toBe(true);
    expect(thesisShownOf(listed, undefined)).toBe(true);
  });
});

describe("MEN-R06: unreportedSeen and reportSeen (work.seen.post)", () => {
  const api = (answer: (n: number) => Promise<{ ok: boolean }>) => {
    let n = 0;
    const calls: { documentId: string; items: { kind: string; id: string }[] }[] = [];
    const fn = (async (_id: string, input: { params: { documentId: string }; body: { items: { kind: string; id: string }[] } }) => {
      calls.push({ documentId: input.params.documentId, items: input.body.items });
      return answer(n++);
    }) as unknown as Parameters<typeof reportSeen>[0];
    return { fn, calls };
  };
  it("lists each shown revision once, skips what was reported and ids the route would refuse", () => {
    const a = req(1, "open"), b = req(2, "responded");
    expect(unreportedSeen([a, b, a], new Set())).toEqual([{ kind: "revision_request", id: a.id }, { kind: "revision_request", id: b.id }]);
    expect(unreportedSeen([a, b], new Set([a.id]))).toEqual([{ kind: "revision_request", id: b.id }]);
    expect(unreportedSeen([{ ...a, id: "not-an-id" }], new Set())).toEqual([]);
    expect(unreportedSeen([], new Set())).toEqual([]);
  });
  it("posts to this work only and returns the accepted ids", async () => {
    const { fn, calls } = api(async () => ({ ok: true }));
    const items = unreportedSeen([req(1, "open")], new Set());
    expect(await reportSeen(fn, "rad-a", items)).toEqual([items[0]!.id]);
    expect(calls).toEqual([{ documentId: "rad-a", items }]);
  });
  it("a refused or thrown call leaves the items unreported", async () => {
    const items = unreportedSeen([req(1, "open")], new Set());
    expect(await reportSeen(api(async () => ({ ok: false })).fn, "rad-a", items)).toEqual([]);
    expect(await reportSeen(api(async () => { throw new Error("mreža"); }).fn, "rad-a", items)).toEqual([]);
  });
  it("sends at most 200 items a call", async () => {
    const many = Array.from({ length: 450 }, (_, i) => ({ kind: "revision_request" as const, id: `00000000-0000-4000-8000-${String(i).padStart(12, "0")}` }));
    const { fn, calls } = api(async (n) => ({ ok: n !== 1 }));
    const done = await reportSeen(fn, "rad-a", many);
    expect(calls.map((c) => c.items.length)).toEqual([200, 200, 50]);
    expect(done).toHaveLength(250);
  });
});
