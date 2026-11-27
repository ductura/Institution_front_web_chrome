// @vitest-environment jsdom
// F4-MEN-R01: "Otvori mentorstvo" over mentorship.open.post. Every person, text and id is invented.
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";

import { mentorPlanText as t } from "./messages.hr";
import { OpenMentorshipCard } from "./OpenMentorshipCard";
import { openMentorship, readPickable, topicOf, type OpenCall } from "./open-mentorship";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const K1 = "6c1d0e9f-8a7b-4c6d-9e5f-4a3b2c1d0e11";
const K2 = "6c1d0e9f-8a7b-4c6d-9e5f-4a3b2c1d0e12";
const S1 = "6c2b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c21";
const S2 = "6c2b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c22";
const M1 = "6c3b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c31";
const student = (studentId: string, givenName: string, familyName: string) => ({ studentId, givenName, familyName, groupName: null, assignments: [] });
type Answer = Awaited<ReturnType<OpenCall>>;
const ok = (body: unknown, status = 200): Answer => ({ ok: true, status, body });
const fail = (status: number): Answer => ({ ok: false, status, code: "x" });

function server(open: Answer | (() => Promise<Answer>), rosters: Record<string, Answer> = {
  [K1]: ok({ students: [student(S2, "Zora", "Izmišljena"), student(S1, "Ana", "Izmišljenić")] }),
  [K2]: ok({ students: [student(S1, "Ana", "Izmišljenić")] }),
}) {
  const sent: { id: string; body: unknown }[] = [];
  const call: OpenCall = async (id, input) => {
    sent.push({ id, body: input.body });
    if (id === "teacher.courses.get") return ok({ courses: Object.keys(rosters).map((id) => ({ id })) });
    if (id === "teacher.course-students.get") return rosters[input.params!.courseId]!;
    return typeof open === "function" ? open() : open;
  };
  return { call, sent };
}

describe("readPickable", () => {
  it("is every student of the teacher's courses once, by name", async () => {
    expect(await readPickable(server(fail(500)).call)).toEqual({ kind: "ready", students: [
      { studentId: S1, name: "Ana Izmišljenić" }, { studentId: S2, name: "Zora Izmišljena" },
    ] });
  });
  it("one failed roster is unavailable, never a shorter list; 401 is signed out", async () => {
    expect(await readPickable(server(fail(500), { [K1]: ok({ students: [] }), [K2]: fail(503) }).call)).toEqual({ kind: "unavailable" });
    expect(await readPickable(server(fail(500), { [K1]: fail(401) }).call)).toEqual({ kind: "signedOut" });
    expect(await readPickable(server(fail(500), { [K1]: ok({ students: [{ studentId: "x" }] }) }).call)).toEqual({ kind: "unavailable" });
  });
});

describe("topicOf", () => {
  it("blank is no topic, up to 300 code points is the trimmed topic, more is refused", () => {
    expect(topicOf("   ")).toEqual({ ok: true, topic: null });
    expect(topicOf(" Izmišljena tema ")).toEqual({ ok: true, topic: "Izmišljena tema" });
    expect(topicOf("😀".repeat(300))).toEqual({ ok: true, topic: "😀".repeat(300) });
    expect(topicOf("a".repeat(301))).toEqual({ ok: false });
  });
});

describe("openMentorship", () => {
  const input = { studentId: S1, workType: "master_thesis" as const, topic: null };
  it("sends the student, the kind and the topic only when there is one", async () => {
    const s = server(ok({ mentorshipId: M1 }, 201));
    expect(await openMentorship(s.call, input)).toEqual({ kind: "opened", mentorshipId: M1 });
    await openMentorship(s.call, { ...input, topic: "Izmišljena tema" });
    expect(s.sent.map((x) => x.body)).toEqual([{ studentId: S1, workType: "master_thesis" }, { studentId: S1, workType: "master_thesis", topic: "Izmišljena tema" }]);
  });
  it("says what the server said, and unknown for anything else", async () => {
    const outcome = async (a: Answer) => (await openMentorship(server(a).call, input)).kind;
    expect(await outcome(fail(401))).toBe("signedOut");
    expect(await outcome(fail(404))).toBe("notFound");
    expect(await outcome(fail(409))).toBe("alreadyOpen");
    expect(await outcome(fail(422))).toBe("invalid");
    expect(await outcome(fail(503))).toBe("noRule");
    expect(await outcome(fail(500))).toBe("unknown");
    expect(await outcome(ok({}, 201))).toBe("unknown");
    expect(await openMentorship(server(() => Promise.reject(new Error("offline"))).call, input)).toEqual({ kind: "unknown" });
  });
});

describe("OpenMentorshipCard", () => {
  let root: Root | null = null;
  afterEach(() => { act(() => root?.unmount()); root = null; document.body.innerHTML = ""; });
  const settle = () => act(async () => { for (let i = 0; i < 5; i++) await new Promise((r) => setTimeout(r, 0)); });
  async function mount(call: OpenCall, onOpened = () => {}) {
    const host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    await act(async () => { root!.render(h(OpenMentorshipCard, { call: () => call, onOpened })); });
    await settle();
    return host;
  }
  const choose = (select: HTMLSelectElement, value: string) => act(() => {
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")!.set!.call(select, value);
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
  const submit = async (host: HTMLElement) => {
    const open = [...host.querySelectorAll("button")].find((b) => b.textContent === t.open.button)!;
    await act(async () => { open.click(); });
    await settle();
  };

  it("asks for a student first, then opens and says so only after the 201", async () => {
    const s = server(ok({ mentorshipId: M1 }, 201));
    let opened = 0;
    const host = await mount(s.call, () => { opened += 1; });
    const [who, kind] = [...host.querySelectorAll("select")] as HTMLSelectElement[];
    expect([...who!.options].map((o) => o.textContent)).toEqual([t.open.studentPlaceholder, "Ana Izmišljenić", "Zora Izmišljena"]);
    await submit(host);
    expect(host.querySelector('[role="alert"]')?.textContent).toBe(t.open.studentRequired);
    expect(s.sent.some((x) => x.id === "mentorship.open.post")).toBe(false);
    choose(who!, S2);
    choose(kind!, "doctoral_thesis");
    await submit(host);
    expect(s.sent.filter((x) => x.id === "mentorship.open.post").map((x) => x.body)).toEqual([{ studentId: S2, workType: "doctoral_thesis" }]);
    expect(host.querySelector('[role="status"]')?.textContent).toBe(t.open.opened);
    expect(opened).toBe(1);
  });

  it("a 409 says the mentorship is already open and does not count as opened", async () => {
    const s = server(fail(409));
    let opened = 0;
    const host = await mount(s.call, () => { opened += 1; });
    choose(host.querySelector("select")!, S1);
    await submit(host);
    expect(host.querySelector('[role="alert"]')?.textContent).toBe(t.open.alreadyOpen);
    expect(opened).toBe(0);
  });
});
