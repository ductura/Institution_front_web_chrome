import { describe, expect, it } from "vitest";

import { findForbiddenTerms } from "../../../../../../scripts/forbidden-terms/terms.ts";
import { messagesHr } from "../../../../../../src/lib/i18n/messages.hr";
import { mentorCardHr } from "../../editor/mentor/messages.hr";
import { consultHr } from "../../editor/work/consult/messages.hr";
import { mentorshipRequestText } from "../../student/mentorship-request/messages.hr";
import { keyDatesMessages } from "../key-dates/messages.hr";
import { n12Messages } from "../n12/messages.hr";
import { mentorPlanText, myStudentsText, overviewText } from "./messages.hr";

// NF-6 MK-17: one pass over every text of mentoring (the Mentor card, consultations, the record, the mentor's
// pages, the timeline, the student's mentorship page). Functions are called with invented values so their
// sentences are read too.
const SAMPLE = ["Izmišljena etapa", "3", "4. 12. 2026."];
function strings(value: unknown, path: string, out: Array<[string, string]>): Array<[string, string]> {
  if (typeof value === "string") out.push([path, value]);
  else if (typeof value === "function") {
    const args = Array.from({ length: (value as (...a: unknown[]) => unknown).length }, (_, i) => (i === 0 || i > 2 ? SAMPLE[0] : SAMPLE[i]));
    strings((value as (...a: unknown[]) => unknown)(...args), `${path}()`, out);
  } else if (value !== null && typeof value === "object") {
    for (const [key, inner] of Object.entries(value)) strings(inner, `${path}.${key}`, out);
  }
  return out;
}

const CATALOGS = {
  overviewText, myStudentsText, mentorPlanText, keyDatesMessages, mentorshipRequestText, mentorCardHr, consultHr, n12Messages,
  mentoredWorks: messagesHr.mentoredWorks, mentorshipRequests: messagesHr.mentorshipRequests,
};
const ALL = Object.entries(CATALOGS).flatMap(([name, catalog]) => strings(catalog, name, []));
/** The catalogs of this task's lane (teacher/mentorships, teacher/key-dates, student/mentorship-request). */
const OWN = ["overviewText", "myStudentsText", "mentorPlanText", "keyDatesMessages", "mentorshipRequestText"];

/**
 * Findings of the MK-17 pass in catalogs of the editor's lane (host/editor/**), which this task does not touch
 * (the editor plan ED-01…ED-60 owns them). They are listed in the PR under "Otvoreno" with the words to use
 * instead; the list may only shrink: a new finding anywhere fails.
 */
const OPEN_ELSEWHERE = [
  "mentorCardHr.prep.copy · kopirano",
  "mentorCardHr.prep.copied · kopirano",
  "consultHr.records.saved · spremljeno (bez pojašnjenja)",
  "consultHr.records.failed · spremljeno (bez pojašnjenja)",
];

describe("texts of mentoring (MK-17)", () => {
  it("read every catalog", () => {
    expect(ALL.length).toBeGreaterThan(150);
  });

  it("hold no forbidden term (Ductus PRODUCT §5); outside this lane only the listed open findings remain", () => {
    const hits = ALL.flatMap(([path, text]) => findForbiddenTerms(text, "hr").map((term) => `${path} · ${term.entry}`));
    expect(hits.filter((hit) => OWN.some((name) => hit.startsWith(`${name}.`)))).toEqual([]);
    expect(hits.filter((hit) => !OPEN_ELSEWHERE.includes(hit))).toEqual([]);
  });

  it("never punish or accuse, name no model or provider, and use 'izvornost' only as the faculty's form", () => {
    const words = /\bkazn|sankcij|\bvaranj|\bvaral|plagij|sumnjiv|prekršaj|provjer\w* ai|ai[- ]detekt|\bgpt\b|openai|anthropic|claude|gemini|mistral|llama/i;
    expect(ALL.filter(([, text]) => words.test(text))).toEqual([]);
    expect(ALL.filter(([, text]) => /izvornost/i.test(text) && !/Izjava o izvornosti rada/.test(text))).toEqual([]);
  });

  it("call the role beside a work 'mentor' in the overview and the timeline, never 'nastavnik'", () => {
    const own = ALL.filter(([path]) => path.startsWith("overviewText") || path.startsWith("keyDatesMessages"));
    expect(own.filter(([, text]) => /nastavni/i.test(text))).toEqual([]);
  });

  it("state, before a record is saved, that it is neither deleted nor rewritten", () => {
    expect(Object.values(n12Messages).some((text) => typeof text === "string" && text.includes("se ne briše ni ne prepravlja"))).toBe(true);
  });

  it("say whose turn it is in words, never with a number alone (MK-15: state as text beside colour)", () => {
    for (const text of [overviewText.yoursMilestone("Nacrt"), overviewText.studentDue("je danas"), overviewText.submitted, overviewText.unknown]) {
      expect(text).toMatch(/[a-zčćđšž]{3,}/i);
    }
  });
});
