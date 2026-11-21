// @vitest-environment jsdom
import axe from "axe-core";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DeclarationAi, type DeclarationAiLabels, type DeclarationAiState } from "./DeclarationAi";
import type { DeclarationAttachment, DeclarationConversation } from "./declaration-logic";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const labels: DeclarationAiLabels = {
  title: "Izjava o uporabi AI-ja",
  noUse: "U ovom radu nije zabilježena uporaba Asistenta.",
  aiDisabled: "Zadatak ne dopušta ugrađenog Asistenta.",
  loading: "Sastavljam izjavu iz zapisa.",
  error: "Izjavu nije bilo moguće sastaviti.",
  errorNote: "Tehnička greška ne sprječava predaju.",
  retry: "Pokušaj ponovno",
  usesCaption: "Zapisana uporaba",
  colPurpose: "Svrha",
  colProvider: "Pružatelj i model",
  colPhase: "Faza",
  requiredHeading: "Prilaže se obvezno",
  requiredNote: "Ovi razgovori se ne mogu izostaviti.",
  othersLegend: "Ostali razgovori",
  othersNote: "Nastavnik ih vidi samo ako ih priložite.",
  review: "Pregledaj točne verzije razgovora koji se prilažu",
  reviewFirst: "Potvrda je dostupna nakon pregleda.",
  reviewTitle: "Razgovori uz izjavu",
  reviewNote: "Ovo su točne verzije razgovora.",
  reviewDone: "Gotov pregled, natrag na izjavu",
  requiredTag: "obvezan",
  chosenTag: "po Vašem odabiru",
  chosenFoot: "Prilaže se Vašim odabirom.",
  student: "Vi",
  stale: "Razgovor se promijenio, pregledaj ponovno.",
  confirm: "Potvrdi izjavu",
};

const required: DeclarationConversation = {
  conversationId: "c-1",
  title: "Razgovor 1 · Lektura",
  reason: "transfer",
  requiredBecause: "Tekst prenesen u rad, odlomak 2.",
  assistantName: "Asistent · Primjer d.o.o., Model A",
  throughSeq: 2,
  messagesSha256: "a".repeat(64),
  turns: [
    { seq: 1, author: "student", text: "Izmišljeno pitanje jedan." },
    { seq: 2, author: "assistant", text: "Izmišljen odgovor jedan." },
    { seq: 3, author: "student", text: "Poruka nakon pregledane verzije." },
  ],
};
const other: DeclarationConversation = {
  conversationId: "c-3",
  title: "Razgovor 3 · Traženje literature",
  reason: "student_added",
  assistantName: "Asistent · Primjer d.o.o., Model A",
  throughSeq: 4,
  messagesSha256: "b".repeat(64),
  turns: [{ seq: 4, author: "assistant", text: "Izmišljen odgovor tri." }],
};
const ready = (conversations: DeclarationConversation[]): DeclarationAiState => ({
  kind: "ready",
  uses: [{ purpose: "Lektura", provider: "Primjer d.o.o., Model A", phase: "Pisanje" }],
  conversations,
});

let root: Root | undefined;
let host: HTMLElement | undefined;
function mount(state: DeclarationAiState, onConfirm = vi.fn()): HTMLElement {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  act(() => root!.render(<DeclarationAi labels={labels} state={state} onConfirm={onConfirm} onRetry={() => undefined} />));
  return host;
}
function rerender(state: DeclarationAiState, onConfirm: (a: DeclarationAttachment[]) => void) {
  act(() => root!.render(<DeclarationAi labels={labels} state={state} onConfirm={onConfirm} />));
}
function button(name: string): HTMLButtonElement {
  const found = [...host!.querySelectorAll("button")].find((b) => b.textContent?.startsWith(name));
  if (!found) throw new Error(`no button ${name}`);
  return found;
}
function checkbox(title: string): HTMLInputElement {
  const label = [...host!.querySelectorAll("label")].find((l) => l.textContent === title);
  return label!.querySelector("input")!;
}
const click = (el: HTMLElement) => act(() => el.click());

afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  root = undefined;
  host = undefined;
});

describe("DeclarationAi", () => {
  it("keeps a required conversation attached: it cannot be unchecked and shows its reason", () => {
    mount(ready([required, other]));
    const box = checkbox(required.title);
    expect(box.checked).toBe(true);
    expect(box.getAttribute("aria-disabled")).toBe("true");
    click(box);
    expect(checkbox(required.title).checked).toBe(true);
    const note = document.getElementById(box.getAttribute("aria-describedby")!);
    expect(note?.textContent).toBe(required.requiredBecause);
  });

  it("waits for the review, then confirms exactly the shown throughSeq and messagesSha256", () => {
    const onConfirm = vi.fn();
    mount(ready([required, other]), onConfirm);
    click(checkbox(other.title));
    expect(button(labels.confirm).getAttribute("aria-disabled")).toBe("true");
    click(button(labels.confirm));
    expect(onConfirm).not.toHaveBeenCalled();

    click(button(labels.review));
    expect(host!.textContent).toContain("Izmišljen odgovor jedan.");
    expect(host!.textContent).not.toContain("Poruka nakon pregledane verzije.");
    click(button(labels.reviewDone));

    expect(button(labels.confirm).hasAttribute("aria-disabled")).toBe(false);
    click(button(labels.confirm));
    expect(onConfirm).toHaveBeenCalledWith([
      { conversationId: "c-1", reason: "transfer", throughSeq: 2, messagesSha256: "a".repeat(64) },
      { conversationId: "c-3", reason: "student_added", throughSeq: 4, messagesSha256: "b".repeat(64) },
    ]);
  });

  it("asks for a new review when the pick or a shown version changes", () => {
    const onConfirm = vi.fn();
    mount(ready([required, other]), onConfirm);
    click(button(labels.review));
    click(button(labels.reviewDone));
    expect(button(labels.confirm).hasAttribute("aria-disabled")).toBe(false);

    click(checkbox(other.title));
    expect(button(labels.confirm).getAttribute("aria-disabled")).toBe("true");
    click(checkbox(other.title));
    expect(button(labels.confirm).hasAttribute("aria-disabled")).toBe(false);

    rerender(ready([{ ...required, throughSeq: 3, messagesSha256: "c".repeat(64) }, other]), onConfirm);
    expect(button(labels.confirm).getAttribute("aria-disabled")).toBe("true");
  });

  it("blocks the confirmation while an attached conversation is stale", () => {
    const onConfirm = vi.fn();
    mount(ready([{ ...required, stale: true }]), onConfirm);
    expect(host!.querySelector('[role="alert"]')?.textContent).toBe(labels.stale);
    click(button(labels.review));
    click(button(labels.reviewDone));
    const confirm = button(labels.confirm);
    expect(confirm.getAttribute("aria-disabled")).toBe("true");
    expect(document.getElementById(confirm.getAttribute("aria-describedby")!)?.textContent).toBe(labels.stale);
    click(confirm);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("does not attach a conversation the student did not pick", () => {
    const onConfirm = vi.fn();
    mount(ready([required, { ...other, stale: true }]), onConfirm);
    expect(host!.querySelector('[role="alert"]')).toBeNull();
    click(button(labels.review));
    expect(host!.textContent).not.toContain(other.title);
    click(button(labels.reviewDone));
    click(button(labels.confirm));
    expect(onConfirm).toHaveBeenCalledWith([expect.objectContaining({ conversationId: "c-1" })]);
  });

  it("confirms with nothing attached when no use was recorded or the assistant is off", () => {
    for (const kind of ["no_use", "ai_disabled"] as const) {
      const onConfirm = vi.fn();
      mount({ kind }, onConfirm);
      expect(host!.textContent).toContain(kind === "no_use" ? labels.noUse : labels.aiDisabled);
      click(button(labels.confirm));
      expect(onConfirm).toHaveBeenCalledWith([]);
      act(() => root?.unmount());
      host?.remove();
    }
    root = undefined;
    host = undefined;
  });

  it("announces loading and errors", () => {
    mount({ kind: "loading" });
    expect(host!.querySelector('[role="status"]')?.textContent).toBe(labels.loading);
    act(() => root!.render(<DeclarationAi labels={labels} state={{ kind: "error" }} onConfirm={() => undefined} />));
    expect(host!.querySelector('[role="alert"]')?.textContent).toBe(labels.error);
  });

  it("has no axe violations in the form and in the review", async () => {
    mount(ready([required, other]));
    expect((await axe.run(host!)).violations).toEqual([]);
    click(button(labels.review));
    expect((await axe.run(host!)).violations).toEqual([]);
  });
});
