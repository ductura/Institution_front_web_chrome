// MK-16: the VIZ "puno" mentorship, one work for both sides, answers in the contract's shapes.
import { describe, expect, it } from "vitest";

import { RESPONSES } from "../../../src/client/api";
import { matchesSchema, type Schema } from "../../../src/client/schema-check";
import { generatedServer } from "../e2e/viz/server";
import { MENTORSTVO_T1, MENTORSTVO_T3, RAD_T3 } from "./viz-mentorstvo";
import { DOKUMENT_T1 } from "./viz-predaja";
import { T1, T3, type Answer, type Result } from "./viz-scenariji";

const answered = (r: Result) => r as Answer;
const body = (r: Result) => JSON.parse(answered(r).body ?? "null") as Record<string, any>;
const fits = (id: string, r: Result) => {
  const status = String(answered(r).status);
  expect(matchesSchema(RESPONSES.get(id)?.[status]?.content?.["application/json"]?.schema as Schema, body(r)), id).toBe(true);
};
const SLOT = "00000000-0000-4000-8000-00000000a7a1";
const send = (s: ReturnType<typeof generatedServer>, method: string, path: string, sent: unknown) =>
  s.answer("teacher", method, path, JSON.stringify(sent));

describe("MK-16: the puno mentorship", () => {
  it("T1's mentorship is the document the student opens, and its work is T1's, not submitted", () => {
    const s = generatedServer("puno");
    const works = body(s.answer("teacher", "GET", "/api/v1/teacher/mentorships")).works;
    expect(works.map((w: { documentId: string }) => w.documentId)).toEqual([DOKUMENT_T1, RAD_T3]);
    const opened = body(s.answer("student", "POST", "/api/v1/evidence/open", JSON.stringify({ assignmentId: T1 })));
    expect(opened.documentId).toBe(DOKUMENT_T1);
    const work = s.answer("teacher", "GET", `/api/v1/teacher/works/${DOKUMENT_T1}`);
    fits("teacher.work.get", work);
    expect(body(work)).toMatchObject({ assignmentId: T1, studentName: "Student A", state: "nije_predano", nextDocumentId: RAD_T3 });
    expect(body(s.answer("teacher", "GET", `/api/v1/teacher/works/${RAD_T3}`))).toMatchObject({ assignmentId: T3, state: "predano" });
    const versions = s.answer("student", "GET", `/api/v1/works/${DOKUMENT_T1}/versions`);
    fits("work.versions.get", versions);
    expect(body(versions).versions.some((v: { kind: string }) => v.kind === "submission")).toBe(false);
  });

  it("each mentorship has its own key dates, T1's from its deadline", () => {
    const s = generatedServer("puno");
    const t1 = s.answer("teacher", "GET", `/api/v1/mentorships/${MENTORSTVO_T1}/key-dates`);
    fits("mentorship.key-dates.get", t1);
    expect(body(t1).dates.find((d: { kind: string }) => d.kind === "deadline").at).toBe("2026-11-08T22:59:00.000Z");
    expect(body(s.answer("teacher", "GET", `/api/v1/mentorships/${MENTORSTVO_T3}/key-dates`)).dates).toEqual([]);
  });

  it("a slot's change and closing name the slot, the action and the reason sent", () => {
    const s = generatedServer("puno");
    const base = `/api/v1/works/${DOKUMENT_T1}/consultation-slots/${SLOT}`;
    const confirmed = send(s, "PATCH", base, { action: "confirm" });
    fits("work.consultation-slots.patch", confirmed);
    expect(body(confirmed)).toMatchObject({ id: SLOT, state: "confirmed" });
    expect(body(send(s, "PATCH", base, { action: "counter", startsAt: "2026-12-07T09:00:00.000Z" }))).toMatchObject({ id: SLOT, state: "countered", startsAt: "2026-12-07T09:00:00.000Z" });
    const declined = send(s, "POST", `${base}/close`, { action: "decline" });
    fits("work.consultation-slot-close.post", declined);
    expect(body(declined)).toMatchObject({ id: SLOT, state: "declined", closing: { reason: null } });
    expect(body(send(s, "POST", `${base}/close`, { action: "cancel", reason: "Izmišljeni razlog." }))).toMatchObject({ state: "cancelled", closing: { reason: "Izmišljeni razlog." } });
    expect(body(send(s, "POST", `${base}/close`, { action: "withdraw" }))).toMatchObject({ state: "withdrawn", closing: { by: "student", reason: null } });
  });

  it("an addition to a record is the text typed, under a new id each time", () => {
    const s = generatedServer("puno");
    const path = `/api/v1/works/${DOKUMENT_T1}/consultation-records/6a5b4c3d-2e1f-4a0b-9c8d-7e6f5a4b3c11/additions`;
    const first = send(s, "POST", path, { text: "Izmišljena dopuna." });
    fits("work.consultation-additions.post", first);
    expect(body(first).text).toBe("Izmišljena dopuna.");
    expect(body(send(s, "POST", path, { text: "Druga." })).id).not.toBe(body(first).id);
  });
});
