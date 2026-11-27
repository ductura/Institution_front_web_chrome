// @vitest-environment jsdom
// WEB-PREDAJE-IMENA: the page of the submissions of one assignment shows the student's name from
// teacher.assignment-overview.get, not the student's id. Invented data only.
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const STUDENT_A = "5e4d3c2b-1a09-4f8e-8d7c-6b5a4f3e2d01";
const STUDENT_B = "5e4d3c2b-1a09-4f8e-8d7c-6b5a4f3e2d02";
const ASSIGNMENT = "7a1b2c3d-1111-4222-8333-444455556666";

type Answer = { ok: true; status: number; body: unknown } | { ok: false; status: number; code: string };
const state: { overview: Answer } = { overview: { ok: false, status: 500, code: "x" } };
const asked: string[] = [];

vi.mock("../../../../../../src/client/api.ts", async (original) => ({
  ...(await original<object>()),
  goToSignIn: () => {},
  createApi: () => async (id: string): Promise<Answer> => {
    asked.push(id);
    if (id === "teacher.submissions.get") {
      return {
        ok: true, status: 200,
        body: {
          submissions: [
            { studentId: STUDENT_A, documentId: null, submitted: true, revision: 3, requestedMinute: "2026-12-15T21:30:00.000Z", afterDeadline: false },
            { studentId: STUDENT_B, documentId: null, submitted: true, revision: 1, requestedMinute: "2026-12-15T22:00:00.000Z", afterDeadline: true },
          ],
        },
      };
    }
    if (id === "teacher.assignment-overview.get") return state.overview;
    return { ok: false, status: 500, code: "unavailable" };
  },
}));

import { HostContext } from "../../context";
import { TeacherSubmissionsPage } from "./SubmissionsPage";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const overviewRow = (studentId: string, givenName: string, familyName: string) => ({
  studentId, givenName, familyName, groupName: null, submitted: true,
  requestedMinute: "2026-12-15T21:30:00.000Z", afterDeadline: false, evidenceRecord: null,
});

async function mount(): Promise<string> {
  const host = document.body.appendChild(document.createElement("div"));
  await act(async () => {
    createRoot(host).render(createElement(
      HostContext.Provider,
      { value: { base: "" as never, page: "teacher-submissions" as never, role: null } },
      createElement(TeacherSubmissionsPage, { assignmentId: ASSIGNMENT }),
    ));
  });
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
  return host.textContent ?? "";
}

beforeEach(() => { document.body.innerHTML = ""; asked.length = 0; });

describe("names on the submissions page (WEB-PREDAJE-IMENA)", () => {
  it("shows the name of each student, not the id", async () => {
    state.overview = {
      ok: true, status: 200,
      body: { students: [overviewRow(STUDENT_A, "Ana", "Primjerić"), overviewRow(STUDENT_B, "Ivo", "Izmišljenić")] },
    };
    const text = await mount();
    expect(asked).toContain("teacher.assignment-overview.get");
    expect(text).toContain("Ana Primjerić");
    expect(text).toContain("Ivo Izmišljenić");
    expect(text).not.toContain(STUDENT_A);
    expect(text).not.toContain(STUDENT_B);
  });

  it("a student without a name in the overview keeps the id, and the rest are named", async () => {
    state.overview = {
      ok: true, status: 200,
      body: { students: [overviewRow(STUDENT_A, "Ana", "Primjerić")] },
    };
    const text = await mount();
    expect(text).toContain("Ana Primjerić");
    expect(text).toContain(STUDENT_B);
  });

  it("when the overview read fails the list still shows, by id", async () => {
    state.overview = { ok: false, status: 500, code: "unavailable" };
    const text = await mount();
    expect(text).toContain(STUDENT_A);
    expect(text).toContain(STUDENT_B);
  });
});
