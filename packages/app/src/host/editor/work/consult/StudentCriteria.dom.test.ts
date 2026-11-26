// @vitest-environment jsdom
// ED-35: the student reads each teacher's working criteria separately, never merged, and writes nothing.
// The route is a fake answer in the shape of student.working-criteria.get (Institution_server#838);
// ids and names are invented.
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { StudentCriteriaCall } from "../../../../../../../src/client/student-working-criteria";
import { CRITERION_IDS } from "../../../../../../../src/client/teacher-working-criteria";

import { ConsultPanel } from "./ConsultPanel";
import { StudentCriteria } from "./StudentCriteria";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const DOC = "izmisljeni-rad-0001";
const six = (rated: Partial<Record<string, 0 | 1 | 2>>, note: string | null = null) =>
  CRITERION_IDS.map((id) => ({ id, label: `workingCriteria.${id}`, assessment: rated[id] ?? null, note: id === "topic" ? note : null }));
const TWO = {
  teachers: [
    { teacherId: "00000000-0000-4000-8000-0000000000a1", teacherName: { givenName: "Izmišljena", familyName: "Nastavnica" }, criteria: six({ topic: 2, sources: 1 }, "Jasno postavljeno pitanje.") },
    { teacherId: "00000000-0000-4000-8000-0000000000a2", teacherName: null, criteria: six({ language: 0 }) },
  ],
};
const answer = (body: unknown, status = 200): StudentCriteriaCall =>
  vi.fn(async () => (status === 200 ? { ok: true as const, status, body } : { ok: false as const, status, code: "x" }));

describe("StudentCriteria", () => {
  let root: Root | undefined;
  let host: HTMLElement;
  afterEach(() => { act(() => root?.unmount()); root = undefined; document.body.innerHTML = ""; });

  const mount = async (node: ReturnType<typeof h>) => {
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    await act(async () => { root?.render(node); });
  };

  it("shows each teacher's criteria in a section of its own, with no write control", async () => {
    const call = answer(TWO);
    await mount(h(StudentCriteria, { documentId: DOC, call }));
    expect(call).toHaveBeenCalledWith("student.working-criteria.get", { params: { documentId: DOC }, query: undefined });
    const sections = host.querySelectorAll("section");
    expect(sections).toHaveLength(2);
    expect(sections[0]?.textContent).toContain("Kriteriji ocjene · 2 od 6");
    expect(sections[0]?.textContent).toContain("Nastavnik: Izmišljena Nastavnica");
    expect(sections[0]?.textContent).toContain("vrlo dobro");
    expect(sections[0]?.textContent).toContain("Jasno postavljeno pitanje.");
    expect(sections[1]?.textContent).toContain("Kriteriji ocjene · 1 od 6");
    expect(sections[1]?.textContent).toContain("Nastavnik (ime nije upisano)");
    expect(sections[1]?.textContent).toContain("treba doraditi");
    expect(sections[1]?.textContent).not.toContain("Jasno postavljeno pitanje.");
    expect(host.querySelector("button, textarea")).toBeNull();
  });

  it("says no teacher has set criteria yet for an empty list", async () => {
    await mount(h(StudentCriteria, { documentId: DOC, call: answer({ teachers: [] }) }));
    expect(host.textContent).toContain("Nastavnik još nije postavio kriterije za ovaj rad.");
    expect(host.querySelector("section")).toBeNull();
  });

  it("says unavailable with a retry on 503, and unavailable without a transport", async () => {
    await mount(h(StudentCriteria, { documentId: DOC, call: answer(null, 503) }));
    expect(host.querySelector("[role=alert]")?.textContent).toBe("Kriteriji trenutačno nisu dostupni. Pokušajte ponovno.");
    expect(host.querySelector("button")?.textContent).toBe("Pokušaj ponovno");
    act(() => root?.unmount());
    await mount(h(StudentCriteria, { documentId: DOC, call: null }));
    expect(host.querySelector("[role=alert]")?.textContent).toBe("Kriteriji trenutačno nisu dostupni. Pokušajte ponovno.");
    expect(host.querySelector("button")).toBeNull();
  });

  it("ends the session on 401", async () => {
    const onSessionEnd = vi.fn();
    await mount(h(StudentCriteria, { documentId: DOC, call: answer(null, 401), onSessionEnd }));
    expect(host.textContent).toContain("Prijava je istekla. Prijavite se ponovno.");
    expect(onSessionEnd).toHaveBeenCalledTimes(1);
  });

  it("in the panel the student reads through the student route, never the teacher's", async () => {
    const studentCriteriaCall = answer(TWO);
    const criteriaCall = vi.fn();
    await mount(h(ConsultPanel, { documentId: DOC, role: "student", revision: 1, slotsCall: null, criteriaCall, studentCriteriaCall }));
    expect(studentCriteriaCall).toHaveBeenCalledTimes(1);
    expect(criteriaCall).not.toHaveBeenCalled();
    expect(host.querySelectorAll("[data-student-criteria] section")).toHaveLength(2);
  });
});
