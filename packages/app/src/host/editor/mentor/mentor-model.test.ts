import { describe, expect, it } from "vitest";

import { absStatus, badgeCount, badgeText, inDays, nextStageLine, prepText, stateView } from "./mentor-model";

const NOW = new Date("2026-11-22T10:00:00");
const slot = (state: "requested" | "countered" | "confirmed") => ({ id: state, state, startsAt: "2026-12-01T10:00:00Z" }) as never;
const msg = (senderRole: "student" | "teacher", createdAt: string) => ({ id: createdAt, senderRole, text: "x", createdAt });

describe("inDays", () => {
  it("counts calendar days", () => {
    expect(inDays("2026-11-22T20:00:00", NOW)).toBe("danas");
    expect(inDays("2026-11-23T08:00:00", NOW)).toBe("za 1 dan");
    expect(inDays("2026-11-27T08:00:00", NOW)).toBe("za 5 dana");
    expect(inDays("2026-11-20T08:00:00", NOW)).toBe("prije 2 dana");
  });
});

describe("stateView", () => {
  it("words each state by role", () => {
    expect(stateView("teacher", { kind: "review", round: 2, sentAt: "2026-11-20T10:00:00" }, NOW))
      .toMatchObject({ headline: "Rad čeka Vaš pregled", actions: ["returnForRevision", "accept"] });
    expect(stateView("student", { kind: "review", round: 2, sentAt: "2026-11-20T10:00:00" }, NOW))
      .toMatchObject({ headline: "Rad je kod mentora", actions: [] });
    expect(stateView("student", { kind: "draft" }, NOW)).toMatchObject({ headline: "Rad je kod Vas", sub: "Još nije slan mentoru.", actions: ["sendForReview"] });
  });
  it("revise: due, open must-comments and the way forward", () => {
    const open = stateView("student", { kind: "revise", due: "2026-11-27T10:00:00", mustOpen: 2, request: "Dopunite uvod." }, NOW);
    expect(open.sub).toContain("za 5 dana");
    expect(open.sub).toContain("2 obvezna komentara otvorena");
    expect(open).toMatchObject({ request: "Dopunite uvod.", actions: ["walk"] });
    const done = stateView("student", { kind: "revise", due: null, mustOpen: 0, request: null }, NOW);
    expect(done).toMatchObject({ sub: "svi obvezni komentari su riješeni", actions: ["sendRevision"] });
  });
  it("accepted: consent is the teacher's to give; the collaborator never acts", () => {
    expect(stateView("teacher", { kind: "accepted", consentAt: null }, NOW)).toMatchObject({ sub: "Još niste dali suglasnost za predaju.", actions: ["giveConsent"] });
    expect(stateView("collaborator", { kind: "accepted", consentAt: null }, NOW).actions).toEqual([]);
    expect(stateView("student", { kind: "submitted", submittedAt: null }, NOW).actions).toEqual([]);
  });
});

describe("badge and next stage", () => {
  it("counts the other side's new messages and slots waiting for this role", () => {
    const messages = [msg("student", "2026-11-20T10:00:00Z"), msg("student", "2026-11-21T10:00:00Z"), msg("teacher", "2026-11-21T11:00:00Z")];
    expect(badgeCount("teacher", messages, "2026-11-20T12:00:00Z", [slot("requested"), slot("countered")])).toBe(2);
    expect(badgeCount("student", messages, null, [slot("countered")])).toBe(2);
    expect(badgeCount("collaborator", messages, null, [slot("requested")])).toBe(0);
    expect(badgeText(0)).toBeNull();
    expect(badgeText(2)).toBe("Mentor: 2 novo");
  });
  it("names the first stage that is not approved", () => {
    const stages = [{ id: "a", title: "Prijava teme", description: "", dueAt: null, state: "approved" }, { id: "b", title: "Nacrt", description: "", dueAt: "2026-11-25T10:00:00", state: "open" }] as const;
    expect(nextStageLine(stages, NOW)).toBe(`Sljedeća etapa: Nacrt · rok ${new Intl.DateTimeFormat("hr-HR", { dateStyle: "long" }).format(new Date("2026-11-25T10:00:00"))} (za 3 dana)`);
    expect(nextStageLine([stages[0]], NOW)).toBeNull();
  });
});

describe("abstract and preparation", () => {
  it("says when the abstract is not written", () => {
    expect(absStatus(null)).toBe("nije napisan");
    expect(absStatus(180)).toBe("180 riječi");
  });
  it("leaves out what the page does not know", () => {
    const text = prepText({ since: null, changed: 3, resolved: null, agreed: [{ text: "Nova literatura", done: true }, { text: "Zaključak", done: false }], openComments: 4, words: null, toReview: null });
    expect(text.split("\n")).toEqual(["Priprema za konzultacije", "izmijenjeno odlomaka: 3", "Od dogovorenog:", "✓ Nova literatura", "○ Zaključak", "Otvoreni komentari: 4", "Što trebam od mentora:"]);
  });
});
