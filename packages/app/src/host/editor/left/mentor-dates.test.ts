import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { FAKE_KEY_DATES } from "../../teacher/key-dates/fake-port";
import { MentorDatesView } from "./LeftSectionsHost";
import { readMentorDates, type MentorDatesCall } from "./mentor-dates";
import { leftHr } from "./messages.hr";

// Invented ids, names and dates only. "Today": 1. 12. 2026. at noon, Zagreb.
const NOW = Date.parse("2026-12-01T11:00:00.000Z");
const WORK = "00000000-0000-4000-8000-00000000000a";
const MENTORSHIP = "00000000-0000-4000-8000-0000000000aa";
const mentorship = (assignmentId: string | null) => ({
  mentorshipId: MENTORSHIP, assignmentId, workType: "master_thesis", topic: "Izmišljena tema", mentorId: "00000000-0000-4000-8000-0000000000bb",
  mentorName: { givenName: "Iva", familyName: "Izmišljena" }, startedAt: "2026-10-01T08:00:00.000Z", openedBy: "teacher",
});

type Answer = { ok: true; status: number; body: unknown } | { ok: false; status: number; code: string };
function fake(mentorships: Answer, dates: Answer = { ok: true, status: 200, body: { dates: (FAKE_KEY_DATES as unknown as { dates: unknown[] }).dates } }) {
  const asked: { id: string; mentorshipId?: string }[] = [];
  const call = (async (id: string, input: { params?: { id: string } }) => {
    asked.push({ id, mentorshipId: input.params?.id });
    return id === "mentorship.student-mentorships.get" ? mentorships : dates;
  }) as unknown as MentorDatesCall;
  return { call, asked };
}
const ok = (body: unknown): Answer => ({ ok: true, status: 200, body });

describe("ED-37: the mentorship's dates in Rokovi", () => {
  it("finds this work's mentorship and lists the milestones and consultations ahead, without the submission deadline", async () => {
    const { call, asked } = fake(ok({ mentorships: [mentorship("00000000-0000-4000-8000-00000000000f"), { ...mentorship(WORK), mentorshipId: MENTORSHIP }] }));
    const dates = await readMentorDates(call, WORK, NOW);
    expect(asked).toEqual([{ id: "mentorship.student-mentorships.get", mentorshipId: undefined }, { id: "mentorship.key-dates.get", mentorshipId: MENTORSHIP }]);
    expect(dates).toMatchObject({ kind: "ready", past: 1 });
    if (dates.kind !== "ready") throw new Error("not ready");
    expect(dates.ahead.map((r) => `${r.label} · ${r.when} · ${r.relative}`)).toEqual(["Konzultacije (potvrđene) · 20. 1. 2027. u 11:00 · za 50 dana"]);
    const html = renderToStaticMarkup(createElement(MentorDatesView, { dates }));
    expect(html).toContain("Konzultacije (potvrđene) · 20. 1. 2027. u 11:00 · za 50 dana");
    expect(html).toContain(leftHr.deadlines.mentorshipPast(1));
    expect(html).not.toContain("Rok predaje");
  });

  it("a work outside every mentorship says so and reads no dates", async () => {
    const { call, asked } = fake(ok({ mentorships: [mentorship(null)] }));
    expect(await readMentorDates(call, WORK, NOW)).toEqual({ kind: "none" });
    expect(asked).toHaveLength(1);
    expect(renderToStaticMarkup(createElement(MentorDatesView, { dates: { kind: "none" } }))).toContain(leftHr.deadlines.mentorshipNone);
  });

  it("a failed or malformed read is unavailable or signed out, never an empty list", async () => {
    expect(await readMentorDates(fake({ ok: false, status: 401, code: "unauthorized" }).call, WORK, NOW)).toEqual({ kind: "signedOut" });
    expect(await readMentorDates(fake({ ok: false, status: 503, code: "unavailable" }).call, WORK, NOW)).toEqual({ kind: "unavailable" });
    expect(await readMentorDates(fake(ok({ mentorships: [{ assignmentId: WORK }] })).call, WORK, NOW)).toEqual({ kind: "unavailable" });
    expect(await readMentorDates(fake(ok({ mentorships: [mentorship(WORK)] }), { ok: false, status: 404, code: "not_found" }).call, WORK, NOW)).toEqual({ kind: "unavailable" });
    const thrown = (async () => { throw new Error("mreža"); }) as unknown as MentorDatesCall;
    expect(await readMentorDates(thrown, WORK, NOW)).toEqual({ kind: "unavailable" });
    expect(renderToStaticMarkup(createElement(MentorDatesView, { dates: { kind: "unavailable" } }))).toContain(leftHr.deadlines.mentorshipUnavailable);
  });

  it("a mentorship with nothing ahead says so", async () => {
    const { call } = fake(ok({ mentorships: [mentorship(WORK)] }), ok({ dates: [] }));
    const dates = await readMentorDates(call, WORK, NOW);
    expect(dates).toEqual({ kind: "ready", ahead: [], past: 0 });
    expect(renderToStaticMarkup(createElement(MentorDatesView, { dates }))).toContain(leftHr.deadlines.mentorshipEmpty);
  });
});
