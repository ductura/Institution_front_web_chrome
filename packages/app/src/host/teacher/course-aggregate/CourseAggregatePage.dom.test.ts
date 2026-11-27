// @vitest-environment jsdom
// PIL-K-ZBIRNO: the course aggregate page as a teacher meets it, over createApi with a stand-in transport.
// Suppressed course, a hidden measure (and the others hidden with it), failure with retry, signed out. Invented data.
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";

import { createApi, signInHref } from "../../../../../../src/client/api";
import { HostContext, type HostValue } from "../../context";
import type { AssignmentRead } from "../assignment-card/model";
import CourseAggregatePage from "./CourseAggregatePage";
import { aggregatePath } from "./model";
import { courseAggregateMessages as text } from "./messages.hr";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const COURSE = "00000000-0000-4000-8000-0000000000c1";
const A1 = "00000000-0000-4000-8000-0000000000a1";
const COURSES = {
  courses: [{ id: COURSE, name: "Izmišljeni seminar iz ekologije grada", academicYear: "2026/2027", aiPolicy: "partially_allowed",
    assignments: [{ id: A1, title: "Kućno kompostiranje", workType: "seminar_paper", opensAt: "2026-10-01T08:00:00.000Z",
      dueAt: "2026-12-15T22:59:00.000Z", currentVersion: 1, enrolledStudents: 20 }] }],
};
type Answer = { status: number; body: unknown };
const available = (notStarted: number, inProgress: number, submitted: number): Answer => ({
  status: 200, body: { status: "available", started: inProgress + submitted, submitted, stages: { notStarted, inProgress, submitted } },
});
const notPractice = async (): Promise<AssignmentRead> => ({ kind: "ready", value: { isPractice: false } } as unknown as AssignmentRead);
const HOST = { base: "/aplikacija", page: { path: "/nastavnik/kolegiji/[courseId]/zbirno" }, role: "teacher" } as unknown as HostValue;

describe("CourseAggregatePage in the browser (PIL-K-ZBIRNO)", () => {
  let root: Root | undefined;
  afterEach(() => {
    act(() => root?.unmount());
    document.body.innerHTML = "";
  });

  /** Mounts the page; each aggregate read takes the next answer (the last one repeats). */
  const mount = async (answers: Answer[], courses: Answer = { status: 200, body: COURSES }) => {
    const left: string[] = [];
    let reads = 0;
    const client = () => createApi({
      baseUrl: "http://127.0.0.1:1",
      fetchImpl: async (input) => {
        const url = String(input instanceof Request ? input.url : input);
        const answer = url.includes("/aggregate") ? answers[Math.min(reads++, answers.length - 1)]! : courses;
        return new Response(JSON.stringify(answer.body), { status: answer.status, headers: { "content-type": "application/json" } });
      },
    });
    const host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    await act(async () => {
      root?.render(h(HostContext.Provider, { value: HOST }, h(CourseAggregatePage, { courseId: COURSE, client, readAssignment: notPractice, leave: (href) => left.push(href) })));
    });
    return { host, left };
  };
  const section = (host: HTMLElement) => host.querySelector(`section[aria-label="${text.title}"]`)!;

  it("shows the suppressed state and no number below the threshold", async () => {
    const { host } = await mount([{ status: 200, body: { status: "suppressed" } }]);
    const state = section(host).querySelector('[data-state="suppressed"]');
    expect(state?.getAttribute("role")).toBe("status");
    expect(state?.textContent).toContain(text.suppressedTitle);
    expect(section(host).textContent).not.toMatch(/\d/);
    expect(host.querySelector("[data-chart]")).toBeNull();
  });

  it("hides a small measure and the others with it, so the total cannot give it away (3/7/10 of 20)", async () => {
    const { host } = await mount([available(3, 7, 10)]);
    const items = [...section(host).querySelectorAll("li[data-measure]")].map((li) => li.textContent);
    expect(items).toEqual([
      `${text.measureSubmitted}: ${text.measureSuppressedNote}`,
      `${text.measureInProgress}: ${text.measureSuppressedNote}`,
      `${text.measureNotStarted}: ${text.measureSuppressedNote}`,
    ]);
    expect(host.querySelector("[data-chart]")?.getAttribute("aria-label")).not.toMatch(/\d/);
    expect(section(host).textContent).not.toMatch(/\d/);
  });

  it("shows every share with its text alternative when every group reaches the threshold", async () => {
    const { host } = await mount([available(5, 5, 10)]);
    const items = [...section(host).querySelectorAll("li[data-measure]")].map((li) => li.textContent);
    expect(items[0]).toBe(`${text.measureSubmitted}: ${text.shareOf(10, 20, 50)}`);
    expect(host.querySelector("[data-chart]")?.getAttribute("aria-label")).toContain(text.chartPart(text.measureNotStarted, 25));
    expect(host.querySelector("h1")?.textContent).toBe(text.courseTitle("Izmišljeni seminar iz ekologije grada"));
  });

  it("says the aggregate is unavailable on a failure and reads it again on retry", async () => {
    const { host } = await mount([{ status: 503, body: { code: "unavailable" } }, available(5, 5, 10)]);
    expect(section(host).querySelector('[role="alert"]')?.textContent).toBe(text.unavailable);
    expect(section(host).textContent).not.toMatch(/\d/);
    const retry = [...section(host).querySelectorAll("button")].find((b) => b.textContent === text.retry);
    await act(async () => { retry!.click(); });
    expect(section(host).querySelector('[role="alert"]')).toBeNull();
    expect(section(host).querySelectorAll("li[data-measure]")).toHaveLength(3);
  });

  it("sends a signed-out teacher to sign-in and back to this course's aggregate", async () => {
    const { left } = await mount([available(5, 5, 10)], { status: 401, body: { code: "unauthorized" } });
    expect(left).toEqual([signInHref(`/aplikacija${aggregatePath(COURSE)}`)]);
  });
});
