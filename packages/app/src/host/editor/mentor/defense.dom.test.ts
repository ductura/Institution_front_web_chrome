// @vitest-environment jsdom
// ED-121: "Kostur za obranu" composed from the work (prototype tools.js defenseText). Invented texts only.
import { Editor } from "@tiptap/core";
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { createEditorExtensionsV2 } from "@/editor";

import { findForbiddenTerms } from "../../../../../../scripts/forbidden-terms/terms.ts";
import { DefensePanel } from "./DefensePanel";
import { defenseInputOf, defenseKey, defenseText, firstSentences, hypothesesOf, loadDefense, type OutlineDoc } from "./defense-model";
import { mentorCardHr } from "./messages.hr";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const t = mentorCardHr.defense;

let n = 0;
const id = () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;
const head = (text: string, level = 1) => ({ type: "heading", attrs: { level, nodeId: id() }, content: [{ type: "text", text }] });
const para = (text: string) => ({ type: "paragraph", attrs: { nodeId: id() }, content: [{ type: "text", text }] });
const DOC = {
  type: "doc",
  content: [
    head("Uvod"), para("Kišni vrtovi u gradu Izmišljevu zadržavaju vodu. Druga rečenica ne ulazi."),
    head("Metoda"), head("Uzorak", 2), para("Promatrano je dvanaest izmišljenih vrtova, a H2 se provjerava mjerenjem."),
    head("Rasprava"),
    head("Zaključak"), para("H1 je potvrđena. Vrtovi smanjuju otjecanje. Treća rečenica ne ulazi."),
  ],
};

describe("ED-121 Kostur za obranu", () => {
  let root: Root | undefined;
  let editor: Editor | undefined;
  afterEach(() => { act(() => root?.unmount()); editor?.destroy(); root = undefined; editor = undefined; document.body.innerHTML = ""; localStorage.clear(); });

  const outline = (title: string | null, thesis: string) => {
    editor = new Editor({ extensions: createEditorExtensionsV2(), content: DOC });
    return defenseText(defenseInputOf(editor.state.doc as unknown as OutlineDoc, title, thesis));
  };

  it("takes the title, the question, a sentence per chapter, two of the conclusion and the hypotheses", () => {
    const text = outline("Kišni vrtovi Izmišljeva", "Smanjuju li kišni vrtovi otjecanje?");
    expect(text).toBe([
      "1. Naslov i tema\n   Kišni vrtovi Izmišljeva",
      "2. Pitanje rada\n   Smanjuju li kišni vrtovi otjecanje?",
      "3. Uvod\n   Kišni vrtovi u gradu Izmišljevu zadržavaju vodu.",
      "4. Metoda\n   Promatrano je dvanaest izmišljenih vrtova, a H2 se provjerava mjerenjem.",
      `5. Rasprava\n   ${t.chapterEmpty}`,
      "6. Zaključak\n   H1 je potvrđena. Vrtovi smanjuju otjecanje.",
      `7. ${t.hypothesesHead}\n   H1, H2: ${t.hypothesesAsk}`,
      `8. ${t.limitsHead}\n   ${t.fillIn}`,
      `9. ${t.closingHead}`,
    ].join("\n\n"));
  });

  it("says what to fill in when the title or the question is missing", () => {
    const text = outline(null, "  ");
    expect(text).toContain(`1. Naslov i tema\n   ${t.titleEmpty}`);
    expect(text).toContain(`2. Pitanje rada\n   ${t.thesisEmpty}`);
  });

  it("splits sentences and orders hypotheses by number", () => {
    expect(firstSentences("Prva. „Druga!” Treća?", 2)).toBe("Prva. „Druga!”");
    expect(firstSentences("Bez točke na kraju", 1)).toBe("Bez točke na kraju");
    expect(hypothesesOf("H10 i H2, opet H2, a H1 na kraju; HH3 nije")).toEqual(["H1", "H2", "H10"]);
  });

  it("keeps the student's edits on this device and composes again on request", async () => {
    let calls = 0;
    const compose = () => `sastav ${++calls}`;
    const copied: string[] = [];
    const host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    await act(async () => { root?.render(h(DefensePanel, { workId: "rad-1", compose, storage: localStorage, onCopy: async (x: string) => { copied.push(x); return true; } })); });
    const area = () => document.querySelector("textarea") as HTMLTextAreaElement;
    expect(area().value).toBe("sastav 1");

    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!;
    await act(async () => { setter.call(area(), "moje riječi"); area().dispatchEvent(new Event("input", { bubbles: true })); });
    expect(localStorage.getItem(defenseKey("rad-1"))).toBe("moje riječi");
    expect(loadDefense(localStorage, "rad-2")).toBeNull();

    await act(async () => { root?.unmount(); });
    root = createRoot(host);
    await act(async () => { root?.render(h(DefensePanel, { workId: "rad-1", compose, storage: localStorage })); });
    expect(area().value).toBe("moje riječi");
    expect(calls).toBe(1);

    const button = (label: string) => [...document.querySelectorAll("button")].find((b) => b.textContent === label) as HTMLButtonElement;
    await act(async () => { button(t.redo).click(); });
    expect(area().value).toBe("sastav 2");
    expect(localStorage.getItem(defenseKey("rad-1"))).toBeNull();

    await act(async () => { root?.unmount(); });
    root = createRoot(host);
    await act(async () => { root?.render(h(DefensePanel, { workId: "rad-1", compose, storage: localStorage, onCopy: async (x: string) => { copied.push(x); return true; } })); });
    await act(async () => { button(t.copy).click(); });
    expect(copied).toEqual(["sastav 3"]);
    expect(document.body.textContent).toContain(t.copied);
  });

  it("uses no forbidden terms", () => {
    // "Kopiraj" is the card's existing button word (prep.copy, the imperative §5 allows); every other text is checked.
    const { copy, ...rest } = t;
    expect(copy).toBe(mentorCardHr.prep.copy);
    expect(findForbiddenTerms(Object.values(rest).join("\n"), "hr")).toEqual([]);
  });
});
