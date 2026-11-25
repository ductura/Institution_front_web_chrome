// @vitest-environment jsdom
// WEB-V20-POSTAVKE-DIJALOG: the way in from the real student toolbar (not the source text), the saved settings put on <html>
// when the toolbar is drawn, and the speed of the dialog reaching the reader. Invented text; fake speechSynthesis.
import { createElement, act } from "react";
import { createRoot } from "react-dom/client";
import { Schema } from "@tiptap/pm/model";
import { EditorState } from "@tiptap/pm/state";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/editor/LocalDocument", () => ({ useLocalEditor: () => null }));

import { createEditorReading } from "../read-aloud/ReadAloudHost";
import type { ReadAloudHost } from "../read-aloud/support";
import { StudentToolbar } from "../toolbar/StudentToolbar";
import { readingSettingsHr as t } from "./messages.hr";
import { READ_ALOUD_RATE_KEY, resetReadAloudRateNow, setReadAloudRate } from "./rate-store";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); };
  document.body.innerHTML = "";
});

const click = (el: Element | undefined) => { if (!el) throw new Error("missing element"); act(() => { (el as HTMLElement).click(); }); };
const byText = (text: string, sel = "button, [role=menuitem]") => [...document.querySelectorAll(sel)].find((e) => e.textContent?.trim().startsWith(text));

describe("reading settings in the student toolbar", () => {
  it("is reached from the Prikaz menu of the real toolbar and opens the dialog", () => {
    const host = document.body.appendChild(document.createElement("div"));
    act(() => { createRoot(host).render(createElement(StudentToolbar, { workPartsKey: "k" })); });
    expect(document.querySelector("dialog[open]")).toBeNull();
    click(byText("Prikaz", "button"));
    click(byText(t.menu, "[role=menuitem], [role=menu] button, li, button"));
    const dialog = document.querySelector("dialog[open]");
    expect(dialog?.textContent).toContain(t.intro);
    expect(dialog?.querySelector(`[role="group"][aria-label="${t.rate.label}"]`)).not.toBeNull();
  });

  it("puts the saved settings on <html> as soon as the toolbar is drawn (after a refresh)", async () => {
    localStorage.setItem("ductura.reading.v1", JSON.stringify({ font: "dyslexia", width: "narrow" }));
    vi.resetModules();
    const { StudentToolbar: Fresh } = await import("../toolbar/StudentToolbar");
    const host = document.body.appendChild(document.createElement("div"));
    act(() => { createRoot(host).render(createElement(Fresh, { workPartsKey: "k" })); });
    expect(document.documentElement.getAttribute("data-reading-font")).toBe("dyslexia");
    expect(document.documentElement.getAttribute("data-reading-width")).toBe("narrow");
  });
});

describe("the speed of the dialog reaches the reader", () => {
  const schema = new Schema({ nodes: { doc: { content: "paragraph+" }, paragraph: { content: "text*", group: "block" }, text: { group: "inline" } } });
  const make = () => {
    const state = EditorState.create({ doc: schema.node("doc", null, [schema.node("paragraph", null, [schema.text("Izmišljena rečenica.")])]) });
    const spoken: { rate: number }[] = [];
    class Utterance { lang = ""; rate = 1; voice = null; onstart = null; onend = null; onerror = null; constructor(public text: string) {} }
    const speech: ReadAloudHost = {
      SpeechSynthesisUtterance: Utterance as never,
      speechSynthesis: { speak: (u) => void spoken.push(u as never), cancel: () => undefined, pause: () => undefined, resume: () => undefined, getVoices: () => [] },
    };
    return { reading: createEditorReading({ isDestroyed: false, state, view: { dispatch: () => undefined } } as never, speech), spoken };
  };

  it("speaks at the chosen speed, and at the default once reset", () => {
    resetReadAloudRateNow();
    setReadAloudRate(1.5);
    const a = make();
    a.reading.read("work");
    expect(a.spoken[0]?.rate).toBe(1.5);
    resetReadAloudRateNow();
    expect(localStorage.getItem(READ_ALOUD_RATE_KEY)).toBeNull();
    const b = make();
    b.reading.read("work");
    expect(b.spoken[0]?.rate).toBe(1);
  });
});
