// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";

import type { DeclarationPort, TeacherDeclarationRead } from "../../../../../../src/client/declaration.ts";
import AiDeclarationSection from "./AiDeclarationSection";
import { unavailableDeclarationPort } from "./ports";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let host: HTMLElement | null = null;

async function show(read: TeacherDeclarationRead | "default") {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  const port: DeclarationPort = {
    readStudent: async () => ({ kind: "unavailable" }),
    confirm: async () => ({ kind: "unavailable" }),
    readTeacher: async () => read as TeacherDeclarationRead,
  };
  await act(async () => {
    root!.render(<AiDeclarationSection port={read === "default" ? unavailableDeclarationPort : port} submissionId="s1" />);
  });
  return host;
}

afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  root = null; host = null;
});

const ready: TeacherDeclarationRead = {
  kind: "ready",
  confirmedAt: "28. 10. 2026.",
  assistantAllowed: true,
  uses: [{ purpose: "Provjera stila", provider: "Asistent Ducture", phase: "pisanje" }],
  transfers: [],
  conversations: [{
    conversationId: "c1", title: "Razgovor o uvodu", reason: "transfer", assistantName: "Asistent", throughSeq: 2,
    turns: [
      { seq: 1, author: "student", text: "Kako poboljšati uvod?" },
      { seq: 2, author: "assistant", text: "Počni konkretnom tvrdnjom." },
      { seq: 3, author: "student", text: "Poslije potvrde." },
    ],
  }],
  external: [],
};

describe("AiDeclarationSection", () => {
  it("says unavailable on a port with nothing to read and does not invent a declaration", async () => {
    const el = await show("default");
    expect(el.textContent).toContain("Izjava o korištenju generativne umjetne inteligencije");
    expect(el.textContent).toContain("Izjavu i priložene razgovore trenutačno nije moguće učitati.");
    expect(el.textContent).not.toContain("Pregledaj razgovor");
  });

  it("shows the no-use declaration", async () => {
    const el = await show({ kind: "no_use", confirmedAt: "28. 10. 2026." });
    expect(el.textContent).toContain("nije koristio/koristila AI alate");
  });

  it("shows the pending state", async () => {
    const el = await show({ kind: "pending" });
    expect(el.textContent).toContain("Dopuna na čekanju");
  });

  it("opens ch-h as a dialog up to the confirmed version and closes it", async () => {
    const el = await show(ready);
    const open = [...el.querySelectorAll("button")].find((b) => b.textContent === "Pregledaj razgovor")!;
    HTMLDialogElement.prototype.showModal ??= function showModal(this: HTMLDialogElement) { this.setAttribute("open", ""); };
    HTMLDialogElement.prototype.close ??= function close(this: HTMLDialogElement) { this.removeAttribute("open"); };
    await act(async () => { open.click(); });
    const dialog = el.querySelector("dialog")!;
    expect(dialog.textContent).toContain("Razgovor 1 · 28. 10. 2026.");
    expect(dialog.textContent).toContain("Točno kako je zabilježen; isti razgovor vidi i student.");
    expect(dialog.textContent).toContain("Počni konkretnom tvrdnjom.");
    expect(dialog.textContent).not.toContain("Poslije potvrde.");
    const close = [...dialog.querySelectorAll("button")].find((b) => b.textContent === "Zatvori")!;
    await act(async () => { close.click(); });
    expect(el.querySelector("dialog")).toBeNull();
  });
});
