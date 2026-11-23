import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { acceptedByExtract, createApi } from "@/client/api";
import { assignmentBody, type AssignmentDraft } from "@/components/teacher/assignment-create";
import { publishAssignment } from "@/components/teacher/TeacherSetup/assignment-mutations";

import { practiceOf, withPractice } from "./form-checks";
import { assignmentFormHr as f } from "./messages.hr";
import { PracticeReadBack } from "./PracticeField";

// PIL-D1-POLJE (P-D1): invented course and assignment, no real people or texts.
const courseId = "0b7c4f0e-6d1a-4c55-9a3e-2f1d8c9b7a61";
const requestKey = "5e3a9c2d-8b14-4f7e-a0c6-1d2e3f4a5b6c";
const draft: AssignmentDraft = {
  title: "Izmišljeni probni esej", workType: "essay", opensAt: "2027-01-10T10:00", dueAt: "2027-01-30T16:00",
  instructions: "", wordMin: "", wordMax: "", aiPurposes: [],
};
const base = () => {
  const body = assignmentBody(draft, "prohibited");
  if (!body) throw new Error("the invented draft must be valid");
  return body;
};
const GRADE = /grade|score|points|mark|ocjen|bod/i;

/** Sends the body through the real typed client, as the form does, and returns what reached the wire. */
async function sent(body: object) {
  const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ id: "9f8e7d6c-5b4a-4321-8fed-cba987654321" }, { status: 201 }));
  const result = await publishAssignment(courseId, body as never, requestKey, createApi({ baseUrl: "https://ductura.invalid", fetchImpl }));
  const init = fetchImpl.mock.calls[0]?.[1];
  return { result, wire: init?.body === undefined ? undefined : JSON.parse(String(init.body)) as Record<string, unknown> };
}

describe("practice flag on the create body (PIL-D1-POLJE)", () => {
  it("a ticked box sends isPractice: true, which the contract accepts and the typed client sends", async () => {
    const body = withPractice(base(), { practice: true });
    expect(body).toMatchObject({ isPractice: true });
    expect(body).not.toHaveProperty("practice");
    expect(acceptedByExtract("institution.course-assignments.post", {
      params: { courseId }, query: undefined, body: { ...body, requestKey },
    })).toBe(true);
    const { result, wire } = await sent(body);
    expect(result).toEqual({ kind: "available", id: "9f8e7d6c-5b4a-4321-8fed-cba987654321" });
    expect(wire?.isPractice).toBe(true);
  });

  it("an unticked box sends no isPractice field at all", async () => {
    for (const practice of [false, undefined]) {
      const body = withPractice(base(), { practice });
      expect(body).not.toHaveProperty("isPractice");
      const { result, wire } = await sent(body);
      expect(result.kind).toBe("available");
      expect(wire).not.toHaveProperty("isPractice");
    }
  });

  it("the old `practice` key is refused by the contract, so it is never sent", () => {
    expect(acceptedByExtract("institution.course-assignments.post", {
      params: { courseId }, query: undefined, body: { ...base(), requestKey, practice: true },
    })).toBe(false);
  });

  it("the body never carries a grade or score field, ticked or not", async () => {
    for (const practice of [true, false]) {
      const { wire } = await sent(withPractice(base(), { practice }));
      expect(Object.keys(wire ?? {}).filter((key) => GRADE.test(key))).toEqual([]);
    }
  });
});

describe("practice flag on the edit page (PIL-D1-POLJE)", () => {
  const box = (html: string) => /<input[^>]*type="checkbox"[^>]*>/.exec(html)?.[0] ?? "";

  it("reads isPractice back from the assignment: only true is a practice assignment", () => {
    expect(practiceOf({ isPractice: true })).toBe(true);
    expect(practiceOf({ isPractice: false })).toBe(false);
    expect(practiceOf({})).toBe(false);
  });

  it("shows the box ticked when editing a practice assignment", () => {
    const html = renderToStaticMarkup(createElement(PracticeReadBack, { current: { isPractice: true } }));
    expect(html).toContain(f.practice.label);
    expect(box(html)).toMatch(/checked/);
    expect(box(html)).toMatch(/disabled/);
    expect(html).toContain(f.practice.fixed);
  });

  it("shows the box unticked for a regular assignment", () => {
    for (const current of [{ isPractice: false }, {}]) {
      expect(box(renderToStaticMarkup(createElement(PracticeReadBack, { current })))).not.toMatch(/checked/);
    }
  });
});
