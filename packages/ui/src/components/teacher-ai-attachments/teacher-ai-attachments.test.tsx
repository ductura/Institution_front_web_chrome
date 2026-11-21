// @vitest-environment jsdom
import axe from "axe-core";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";

import {
  TeacherAiAttachments,
  type TeacherAiAttachmentsLabels,
  type TeacherAiAttachmentsState,
  type TeacherAttachedConversation,
} from "./TeacherAiAttachments";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const labels: TeacherAiAttachmentsLabels = {
  title: "Uporaba AI-ja",
  confirmed: "Izjava potvrđena",
  noUse: "Student je izjavio da nije koristio AI alate.",
  aiDisabled: "Zadatak ne dopušta ugrađenog Asistenta.",
  pendingTag: "Dopuna na čekanju",
  pending: "Izjava se pojavljuje kad je student dopuni.",
  loading: "Učitavam izjavu i priložene razgovore.",
  error: "Izjavu trenutačno nije moguće učitati.",
  errorNote: "Predaja nije promijenjena.",
  retry: "Pokušaj ponovno",
  usesCaption: "Izjava studenta",
  colPurpose: "Svrha",
  colProvider: "Pružatelj i model",
  colPhase: "Faza",
  transfersHeading: "Tekst prenesen u rad iz Asistenta",
  transfersNote: "Popis prikazuje tekst iz predane verzije rada.",
  attachedHeading: "Priloženi razgovori",
  transferTag: "obvezno",
  studentAddedTag: "priložio student",
  attachedNote: "Ostale razgovore student nije priložio i nisu prikazani.",
  externalHeading: "Vanjski alat, izjavljeno",
  externalTag: "izjavljeno",
  externalNote: "Vanjski razgovor je priložio student.",
  open: "Otvori",
  versionNote: "Verzija koju je student potvrdio. Samo za čitanje.",
  student: "Student",
  back: "Natrag na uporabu AI-ja",
  sameView: "Student u svojoj predaji vidi ovaj isti prikaz.",
};

const transferred: TeacherAttachedConversation = {
  conversationId: "c-1",
  title: "Razgovor 1 · Lektura",
  reason: "transfer",
  assistantName: "Asistent · Primjer d.o.o., Model A",
  throughSeq: 2,
  turns: [
    { seq: 1, author: "student", text: "Izmišljeno pitanje jedan." },
    { seq: 2, author: "assistant", text: "Izmišljen odgovor jedan." },
    { seq: 3, author: "student", text: "Poruka nakon potvrđene verzije." },
  ],
  transferredNote: "Preneseno u rad: odlomak 2.",
};
const added: TeacherAttachedConversation = {
  conversationId: "c-3",
  title: "Razgovor 3 · Traženje literature",
  reason: "student_added",
  assistantName: "Asistent · Primjer d.o.o., Model A",
  throughSeq: 1,
  turns: [{ seq: 1, author: "assistant", text: "Izmišljen odgovor tri." }],
};
const ready = (over: Partial<Extract<TeacherAiAttachmentsState, { kind: "ready" }>> = {}): TeacherAiAttachmentsState => ({
  kind: "ready",
  confirmedAt: "6. 11. 18:40",
  assistantAllowed: true,
  uses: [{ purpose: "Lektura", provider: "Primjer d.o.o., Model A", phase: "Pisanje" }],
  transfers: [{ id: "t-1", heading: "Odlomak 2 · Lektura", source: "Primjer d.o.o., Model A · Razgovor 1", text: "Izmišljena prenesena rečenica." }],
  conversations: [transferred, added],
  external: [],
  ...over,
});

let root: Root | undefined;
let host: HTMLElement | undefined;
function mount(state: TeacherAiAttachmentsState): HTMLElement {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  act(() => root!.render(<TeacherAiAttachments labels={labels} state={state} onRetry={() => undefined} />));
  return host;
}
function button(text: string): HTMLButtonElement {
  const found = [...host!.querySelectorAll("button")].find((b) => b.textContent === text);
  if (!found) throw new Error(`no button ${text}`);
  return found;
}
const click = (el: HTMLElement) => act(() => el.click());

afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  root = undefined;
  host = undefined;
});

describe("TeacherAiAttachments", () => {
  it("is read only: no inputs, and the only buttons open and close conversations", () => {
    mount(ready());
    expect(host!.querySelectorAll("input, textarea, select, [contenteditable]").length).toBe(0);
    expect([...host!.querySelectorAll("button")].map((b) => b.textContent)).toEqual([
      `${labels.open} ${transferred.title}`,
      `${labels.open} ${added.title}`,
    ]);
    click(button(`${labels.open} ${transferred.title}`));
    expect(host!.querySelectorAll("input, textarea, select, [contenteditable]").length).toBe(0);
    expect([...host!.querySelectorAll("button")].map((b) => b.textContent)).toEqual([labels.back]);
  });

  it("tags each conversation by its reason", () => {
    mount(ready());
    const rows = [...host!.querySelectorAll("[data-conversation]")].map((r) => r.textContent);
    expect(rows[0]).toContain(labels.transferTag);
    expect(rows[1]).toContain(labels.studentAddedTag);
    expect(host!.textContent).toContain(`${labels.attachedHeading} (2)`);
  });

  it("shows messages only up to through_seq and returns focus to the same open button", () => {
    mount(ready());
    click(button(`${labels.open} ${transferred.title}`));
    expect(document.activeElement?.tagName).toBe("H3");
    expect(host!.textContent).toContain("Izmišljen odgovor jedan.");
    expect(host!.textContent).not.toContain("Poruka nakon potvrđene verzije.");
    expect(host!.textContent).toContain(transferred.transferredNote);
    click(button(labels.back));
    expect(document.activeElement).toBe(button(`${labels.open} ${transferred.title}`));
  });

  it("shows no attached section and no count when nothing is attached", () => {
    mount(ready({ transfers: [], conversations: [] }));
    expect(host!.textContent).not.toContain(labels.attachedHeading);
    expect(host!.textContent).not.toMatch(/\(0\)/u);
    expect(host!.querySelectorAll("button").length).toBe(0);
  });

  it("shows the empty state when the student declared no use", () => {
    mount({ kind: "no_use", confirmedAt: "6. 11. 18:40" });
    expect(host!.textContent).toContain(labels.noUse);
    expect(host!.textContent).toContain(`${labels.confirmed} 6. 11. 18:40`);
    expect(host!.querySelectorAll("li, button").length).toBe(0);
  });

  it("lists declared external conversations without an open button when the assistant was off", () => {
    mount(ready({ assistantAllowed: false, transfers: [], conversations: [], external: [{ id: "e-1", title: "Vanjski razgovor 1" }] }));
    expect(host!.textContent).toContain(labels.aiDisabled);
    expect(host!.textContent).toContain(`${labels.externalHeading} (1)`);
    expect(host!.textContent).toContain(labels.externalTag);
    expect(host!.querySelectorAll("button").length).toBe(0);
  });

  it("announces loading, errors and a pending supplement", () => {
    mount({ kind: "loading" });
    expect(host!.querySelector('[role="status"]')?.textContent).toBe(labels.loading);
    act(() => root!.render(<TeacherAiAttachments labels={labels} state={{ kind: "error" }} onRetry={() => undefined} />));
    expect(host!.querySelector('[role="alert"]')?.textContent).toBe(labels.error);
    expect(button(labels.retry)).toBeTruthy();
    act(() => root!.render(<TeacherAiAttachments labels={labels} state={{ kind: "pending" }} />));
    expect(host!.textContent).toContain(labels.pending);
  });

  it("has no axe violations in the list and in an opened conversation", async () => {
    mount(ready({ external: [{ id: "e-1", title: "Vanjski razgovor 1" }] }));
    expect((await axe.run(host!)).violations).toEqual([]);
    click(button(`${labels.open} ${added.title}`));
    expect((await axe.run(host!)).violations).toEqual([]);
  });
});
