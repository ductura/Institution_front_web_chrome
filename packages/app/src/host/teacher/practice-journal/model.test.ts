import { describe, expect, it } from "vitest";

import type { MentoredWork } from "../../../../../../src/components/teacher/mentored-works-read";
import type { Entry, Placement, Signoff } from "../../student/practice-journal/read";
import { checkOpen, checkSign, placementRows, studentIndex, suggestedThrough, waitingFor } from "./model";

const entry = (id: string, date: string, createdAt = `${date}T10:00:00.000Z`): Entry => ({ entryId: id, date, hours: 1, text: "Izmišljeni zapis", correctsEntryId: null, createdAt });
const signoff = (through: string, signedAt: string): Signoff => ({ signoffId: `s-${through}`, throughDate: through, entryCount: 1, entriesSha256: "0".repeat(64), comment: null, signedAt, mentor: { id: "t1", givenName: "Mentor", familyName: "Izmišljeni" } });
const placement = (id: string, mentorshipId: string, startsOn = "2026-03-02"): Placement => ({ placementId: id, mentorshipId, organisationName: "Izmišljena d.o.o.", startsOn, endsOn: "2026-06-30", entryCount: 0, signedThrough: null });
const work = (mentorshipId: string, student: MentoredWork["student"]): MentoredWork => ({ mentorshipId, assignmentId: "a", documentId: null, student, title: "Izmišljeni rad", workType: "bachelor_thesis", workState: "not_started" });

describe("checkOpen", () => {
  const ok = { mentorshipId: "m1", organisationName: "Izmišljena d.o.o.", startsOn: "2026-03-02", endsOn: "2026-06-30" };
  it("accepts a good draft and sends the NFC form of the name", () => {
    expect(checkOpen(ok, ["m1"])).toEqual({ ok: true, value: ok });
    const composed = checkOpen({ ...ok, organisationName: "C\u030c" }, ["m1"]);
    expect(composed.ok && composed.value.organisationName).toBe("C\u030c".normalize("NFC"));
  });
  it("refuses a mentorship that is not the mentor's own list", () => {
    expect(checkOpen({ ...ok, mentorshipId: "m9" }, ["m1"])).toMatchObject({ ok: false, error: "mentorshipRequired" });
    expect(checkOpen({ ...ok, mentorshipId: "" }, ["m1"])).toMatchObject({ ok: false, error: "mentorshipRequired" });
  });
  it("refuses a bad name: blank, 121 code points, edge spaces, control and bidi characters; counts code points, not units", () => {
    expect(checkOpen({ ...ok, organisationName: "  " }, ["m1"])).toMatchObject({ error: "organisationRequired" });
    expect(checkOpen({ ...ok, organisationName: "a".repeat(121) }, ["m1"])).toMatchObject({ error: "organisationTooLong" });
    expect(checkOpen({ ...ok, organisationName: "😀".repeat(120) }, ["m1"]).ok).toBe(true);
    expect(checkOpen({ ...ok, organisationName: " a" }, ["m1"])).toMatchObject({ error: "organisationInvalid" });
    expect(checkOpen({ ...ok, organisationName: "a\u0007b" }, ["m1"])).toMatchObject({ error: "organisationInvalid" });
    expect(checkOpen({ ...ok, organisationName: "a\u202eb" }, ["m1"])).toMatchObject({ error: "organisationInvalid" });
    expect(checkOpen({ ...ok, organisationName: "a\nb" }, ["m1"])).toMatchObject({ error: "organisationInvalid" });
  });
  it("refuses missing, impossible and reversed dates; a one-day practice is fine", () => {
    expect(checkOpen({ ...ok, startsOn: "" }, ["m1"])).toMatchObject({ error: "startRequired" });
    expect(checkOpen({ ...ok, startsOn: "2026-02-30" }, ["m1"])).toMatchObject({ error: "startInvalid" });
    expect(checkOpen({ ...ok, endsOn: "" }, ["m1"])).toMatchObject({ error: "endRequired" });
    expect(checkOpen({ ...ok, endsOn: "30.6.2026" }, ["m1"])).toMatchObject({ error: "endInvalid" });
    expect(checkOpen({ ...ok, endsOn: "2026-03-01" }, ["m1"])).toMatchObject({ error: "endBeforeStart" });
    expect(checkOpen({ ...ok, endsOn: ok.startsOn }, ["m1"]).ok).toBe(true);
  });
});

describe("waitingFor and checkSign", () => {
  const entries = [entry("e2", "2026-04-02"), entry("e1", "2026-04-01")];
  it("lists the entries no signature covers, oldest date first", () => {
    expect(waitingFor(entries, []).map((e) => e.entryId)).toEqual(["e1", "e2"]);
    expect(waitingFor(entries, [signoff("2026-04-01", "2026-04-03T08:00:00.000Z")]).map((e) => e.entryId)).toEqual(["e2"]);
  });
  it("an entry added later for an older date is not covered by the earlier signature", () => {
    const late = entry("e3", "2026-03-30", "2026-04-04T09:00:00.000Z");
    expect(waitingFor([...entries, late], [signoff("2026-04-02", "2026-04-03T08:00:00.000Z")]).map((e) => e.entryId)).toEqual(["e3"]);
  });
  it("offers the newest waiting date, or nothing", () => {
    expect(suggestedThrough(entries, [])).toBe("2026-04-02");
    expect(suggestedThrough(entries, [signoff("2026-04-02", "2026-04-03T08:00:00.000Z")])).toBe("");
  });
  it("refuses to sign when nothing waits (so that equals the server's 409 and costs no call)", () => {
    expect(checkSign({ throughDate: "2026-04-02", comment: "" }, entries, [signoff("2026-04-02", "2026-04-03T08:00:00.000Z")])).toEqual({ ok: false, field: "form", error: "nothingNew" });
    expect(checkSign({ throughDate: "2026-04-02", comment: "" }, [], [])).toMatchObject({ error: "nothingNew" });
  });
  it("leaves a blank comment out and refuses a bad date or comment", () => {
    expect(checkSign({ throughDate: "2026-04-02", comment: "" }, entries, [])).toEqual({ ok: true, value: { throughDate: "2026-04-02" } });
    expect(checkSign({ throughDate: "2026-04-02", comment: "Dobro." }, entries, [])).toEqual({ ok: true, value: { throughDate: "2026-04-02", comment: "Dobro." } });
    expect(checkSign({ throughDate: "", comment: "" }, entries, [])).toMatchObject({ error: "throughRequired" });
    expect(checkSign({ throughDate: "2026-13-01", comment: "" }, entries, [])).toMatchObject({ error: "throughInvalid" });
    expect(checkSign({ throughDate: "2026-04-02", comment: "   " }, entries, [])).toMatchObject({ error: "commentBlank" });
    expect(checkSign({ throughDate: "2026-04-02", comment: "a".repeat(1001) }, entries, [])).toMatchObject({ error: "commentTooLong" });
    expect(checkSign({ throughDate: "2026-04-02", comment: "😀".repeat(1000) }, entries, []).ok).toBe(true);
    expect(checkSign({ throughDate: "2026-04-02", comment: "a\u202eb" }, entries, [])).toMatchObject({ error: "commentInvalid" });
  });
});

describe("placementRows", () => {
  const works = [work("m-b", { givenName: "Ana", familyName: "Šimić" }), work("m-a", { givenName: "Marko", familyName: "Babić" }), work("m-n", null)];
  it("orders by the student's place in the works list (family name, hr collation), never by entries or signatures", () => {
    const rows = placementRows([placement("p1", "m-b"), placement("p2", "m-a"), placement("p3", "m-n")], studentIndex(works));
    expect(rows.map((r) => r.placement.placementId)).toEqual(["p2", "p1", "p3"]);
    expect(rows.map((r) => r.student)).toEqual(["Marko Babić", "Ana Šimić", expect.any(String)]);
  });
  it("keeps a practice of an unknown mentorship, last and without a made-up name", () => {
    const rows = placementRows([placement("p9", "m-x"), placement("p2", "m-a")], studentIndex(works));
    expect(rows.map((r) => r.placement.placementId)).toEqual(["p2", "p9"]);
    expect(rows[1]!.student).toBeNull();
  });
  it("two practices of one student go by start date", () => {
    const rows = placementRows([placement("p2", "m-a", "2026-09-01"), placement("p1", "m-a", "2026-03-02")], studentIndex(works));
    expect(rows.map((r) => r.placement.placementId)).toEqual(["p1", "p2"]);
  });
  it("a mentorship with two works is one student", () => {
    expect(studentIndex([work("m-a", { givenName: "A", familyName: "B" }), work("m-a", { givenName: "A", familyName: "B" })]).size).toBe(1);
  });
});
