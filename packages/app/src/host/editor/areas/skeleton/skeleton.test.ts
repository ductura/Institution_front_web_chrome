// @vitest-environment jsdom
// WEB-V21-DRU-KOSTUR: the skeleton adds headings only, at the end, once, and only after confirmation.
import { Editor } from "@tiptap/core";
import { afterEach, describe, expect, it } from "vitest";

import { createEditorExtensionsV3 } from "../../../../../../editor-core/src/editor/schema";
import { PROFILES, type RuleProfile } from "../../rules/profiles";
import { applySkeleton, DEFAULT_SECTIONS, presentTitles, skeletonAvailability, skeletonAvailable, skeletonSections } from "./skeleton";

const made: Editor[] = [];
function editorWith(content: object[], editable = true): Editor {
  const element = document.createElement("div");
  document.body.append(element);
  const e = new Editor({ element, extensions: createEditorExtensionsV3(), editable, content: { type: "doc", content } });
  made.push(e);
  return e;
}
afterEach(() => { while (made.length) made.pop()!.destroy(); });

const h = (text: string, level = 2) => ({ type: "heading", attrs: { level }, content: [{ type: "text", text }] });
const p = (text: string) => ({ type: "paragraph", content: [{ type: "text", text }] });
const heads = (e: Editor) => e.getJSON().content!.filter((n) => n.type === "heading").map((n) => (n.content![0] as { text: string }).text);
const base: RuleProfile = { id: "x", unitId: "df", label: "Izmišljeni profil", status: "partial", workType: "seminar", sections: [], manualChecks: [], sources: [] };

describe("skeletonSections", () => {
  it("gives the default list for an empty profile or none", () => {
    expect(skeletonSections(base)).toEqual([...DEFAULT_SECTIONS]);
    expect(skeletonSections(null)).toEqual([...DEFAULT_SECTIONS]);
  });
  it("takes the profile's sections, without the ones with their own tool", () => {
    expect(skeletonSections({ ...base, sections: ["izjava", "sadržaj", "uvod", "uvod", "ključne riječi"] })).toEqual(["Uvod", "Ključne riječi"]);
  });
  it("falls back to the default when only own-tool sections remain", () => {
    expect(skeletonSections({ ...base, sections: ["izjava", "sadržaj"] })).toEqual([...DEFAULT_SECTIONS]);
  });
  it("is offered for the area dru only", () => {
    expect(skeletonAvailable(base)).toBe(true);
    expect(skeletonAvailable({ ...base, unitId: "pf" })).toBe(false);
    expect(PROFILES.length).toBeGreaterThan(0);
  });
});

describe("applySkeleton", () => {
  it("leaves the document unchanged when nothing is applied", () => {
    const e = editorWith([h("Naslov", 1), p("Tekst.")]);
    const before = JSON.stringify(e.getJSON());
    expect(applySkeleton(e, [])).toBe(0);
    expect(JSON.stringify(e.getJSON())).toBe(before);
  });
  it("adds only headings at the end", () => {
    const e = editorWith([h("Naslov", 1), p("Tekst.")]);
    expect(applySkeleton(e, ["Uvod", "Zaključak"])).toBe(2);
    expect(e.getJSON().content!.map((n) => n.type)).toEqual(["heading", "paragraph", "heading", "heading"]);
    expect(heads(e)).toEqual(["Naslov", "Uvod", "Zaključak"]);
  });
  it("does not repeat a heading already there, whatever its case or accents", () => {
    const e = editorWith([h("UVOD"), p("Tekst."), h("Zakljucak", 3)]);
    expect(presentTitles(e.state.doc, ["Uvod", "Zaključak", "Rasprava"])).toEqual(new Set(["Uvod", "Zaključak"]));
    expect(applySkeleton(e, ["Uvod", "Zaključak", "Rasprava", "rasprava"])).toBe(1);
    expect(heads(e)).toEqual(["UVOD", "Zakljucak", "Rasprava"]);
  });
  it("refuses a read-only or destroyed editor", () => {
    const ro = editorWith([p("Tekst.")], false);
    expect(applySkeleton(ro, ["Uvod"])).toBeNull();
    expect(heads(ro)).toEqual([]);
    const gone = editorWith([p("Tekst.")]);
    gone.destroy();
    expect(applySkeleton(gone, ["Uvod"])).toBeNull();
    expect(applySkeleton(null, ["Uvod"])).toBeNull();
  });
  it("puts the headings before the work's own Literatura, which stays last", () => {
    const e = editorWith([h("Naslov", 1), p("Tekst."), h("Literatura"), p("Izvor.")]);
    expect(applySkeleton(e, ["Uvod", "Zaključak"])).toBe(2);
    expect(heads(e)).toEqual(["Naslov", "Uvod", "Zaključak", "Literatura"]);
    expect(e.getJSON().content!.map((n) => n.type)).toEqual(["heading", "paragraph", "heading", "heading", "heading", "paragraph"]);
  });
  it("a chosen Literatura goes last, after the other new headings", () => {
    const e = editorWith([h("Naslov", 1), p("Tekst.")]);
    expect(applySkeleton(e, ["Literatura", "Uvod"])).toBe(2);
    expect(heads(e)).toEqual(["Naslov", "Uvod", "Literatura"]);
  });
});

describe("skeletonAvailability", () => {
  it("is off, with the reason, when every section of the list is already in the work", () => {
    const e = editorWith([...DEFAULT_SECTIONS.map((s) => h(s))]);
    expect(skeletonAvailability(e, base)).toEqual({ enabled: false, reason: "Svi odjeljci s popisa već postoje u radu." });
  });
  it("is on while one is missing, and off for another area with its own reason", () => {
    const e = editorWith([h("Uvod"), p("Tekst.")]);
    expect(skeletonAvailability(e, base)).toEqual({ enabled: true });
    expect(skeletonAvailability(e, { ...base, unitId: "pf" })).toMatchObject({ enabled: false, reason: expect.stringContaining("nije dostupan") });
  });
});
