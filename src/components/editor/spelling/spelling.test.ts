import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { Schema } from "@tiptap/pm/model";
import { EditorState, Plugin, TextSelection } from "@tiptap/pm/state";
import { DecorationSet } from "@tiptap/pm/view";

import { SpellingController } from "./controller";
import { createSpeller, loadHrSpeller } from "./engine";
import { goToNext, menuState, toggleSpelling } from "./commands";
import { computeHits, hitAt, nextHit, replaceHit, selectHit, spellingKey } from "./plugin";
import { readSpelling, readWorkIgnored, writeSpelling, writeWorkIgnored } from "./store";
import { scanBlock, type Speller } from "./words";

const dir = new URL("../../../../public/dictionaries/hr/", import.meta.url);
const aff = readFileSync(new URL("hr.aff", dir));
const dic = readFileSync(new URL("hr.dic", dir));
const real = await createSpeller(aff, dic);

const fake = (ok: string[]): Speller => ({ correct: (w) => ok.includes(w), suggest: (w) => [w + "a"] });
const mem = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) }; };
const scan = (text: string, ok: string[], known: string[] = [], names: string[] = []) =>
  scanBlock(text, [], { speller: fake(ok), known: new Set(known), names: new Set(names) }).map((h) => h.word);

describe("the real Croatian dictionary (local files)", () => {
  it("has the 53 711 words of the prototype and knows inflected forms", () => {
    expect(dic.toString("utf8").split("\n")[0]).toBe("53711");
    expect(real.correct("rad")).toBe(true);
    expect(real.correct("studenti")).toBe(true);
    expect(real.correct("kuća")).toBe(true);
    expect(real.correct("kompostiranje")).toBe(true);
  });
  it("flags a misspelling and suggests a correction", () => {
    expect(real.correct("kompostiranjee")).toBe(false);
    expect(real.suggest("kompostiranjee")).toContain("kompostiranje");
  });
  it("loads through two requests for local static files only", async () => {
    const urls: string[] = [];
    const s = await loadHrSpeller(async (u) => { urls.push(u); return { ok: true, arrayBuffer: async () => { const b = readFileSync(new URL(u.split("/").pop()!, dir)); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer; } }; });
    expect(urls.sort()).toEqual(["/dictionaries/hr/hr.aff", "/dictionaries/hr/hr.dic"]);
    expect(s.correct("rad")).toBe(true);
  });
});

describe("which words are marked", () => {
  it("marks unknown words, not known ones", () => {
    expect(scan("rad pgrešan rad", ["rad"])).toEqual(["pgrešan"]);
  });
  it("skips short words, short capitals, inner capitals, the student's words and names", () => {
    expect(scan("x NATO iPhone zzz Kuhn", [], ["zzz"], ["kuhn"])).toEqual([]);
  });
  it("skips a capital in mid-sentence but not at a sentence start", () => {
    expect(scan("Vidi Ivanu", ["Vidi"])).toEqual([]);
    expect(scan("Gotovo. Qwerty", ["Gotovo"])).toEqual(["Qwerty"]);
    expect(scan("Dobro. Kuća", ["Dobro", "kuća"])).toEqual([]);
  });
  it("accepts hyphenated compounds with a known prefix", () => {
    expect(scan("post-xyz", ["xyz"])).toEqual([]);
    expect(scan("abc-xyz", ["xyz"])).toEqual(["abc-xyz"]);
  });
  it("leaves marked ranges (foreign text, links) alone", () => {
    expect(scanBlock("aaa bbb", [[0, 3]], { speller: fake([]), known: new Set() }).map((h) => h.word)).toEqual(["bbb"]);
  });
});

describe("browser state", () => {
  it("round-trips the switch, the student's dictionary and a work's ignored words separately", () => {
    const s = mem();
    expect(readSpelling(s)).toEqual({ enabled: true, user: [] });
    writeSpelling(s, { enabled: false, user: ["abc"] });
    writeWorkIgnored(s, "w1", ["xyz"]);
    expect(readSpelling(s)).toEqual({ enabled: false, user: ["abc"] });
    expect(readWorkIgnored(s, "w1")).toEqual(["xyz"]);
    expect(readWorkIgnored(s, "w2")).toEqual([]);
  });
  it("survives broken or missing storage", () => {
    expect(readSpelling({ getItem: () => "{nope" })).toEqual({ enabled: true, user: [] });
    expect(readSpelling(null).enabled).toBe(true);
    expect(() => writeSpelling({ setItem: () => { throw new Error("full"); } }, { enabled: true, user: [] })).not.toThrow();
  });
});

const schema = new Schema({
  nodes: {
    doc: { content: "block+" },
    paragraph: { group: "block", content: "inline*", toDOM: () => ["p", 0] },
    codeBlock: { group: "block", content: "text*", code: true, toDOM: () => ["pre", 0] },
    text: { group: "inline" },
    cite: { group: "inline", inline: true, atom: true, toDOM: () => ["span"] },
  },
  marks: { lang: { toDOM: () => ["span", 0] } },
});
const doc = (...c: ReturnType<typeof schema.node>[]) => schema.node("doc", null, c);
const para = (...c: (string | ReturnType<typeof schema.node>)[]) => schema.node("paragraph", null, c.map((x) => typeof x === "string" ? schema.text(x) : x));
const stateOf = (d: ReturnType<typeof doc>) => EditorState.create({ doc: d, schema });
const controller = (ok: string[] = ["rad", "dobar"], storage = mem()) => {
  const c = new SpellingController({ workId: "w1", storage, load: async () => fake(ok) });
  c.speller = fake(ok);
  return c;
};

describe("controller and editor positions", () => {
  it("maps hits to document positions across atoms, skips code blocks and foreign text", () => {
    const c = controller();
    const d = doc(para("rad ", schema.node("cite"), " bxd ", schema.text("zzz", [schema.marks.lang!.create()])), schema.node("codeBlock", null, [schema.text("qqq")]));
    const hits = computeHits(d, c, true);
    expect(hits.map((h) => d.textBetween(h.pos, h.pos + h.word.length))).toEqual(["bxd"]);
  });
  it("marks nothing while not writing or while the check is off", () => {
    const c = controller();
    const d = doc(para("bxd"));
    expect(computeHits(d, c, false)).toEqual([]);
    c.setEnabled(false);
    expect(computeHits(d, c, true)).toEqual([]);
  });
  it("goes to the next marked word after the caret and wraps to the first", () => {
    const c = controller();
    const d = doc(para("bxd rad cyd rad dzd"));
    const hits = computeHits(d, c, true);
    const plugin = new Plugin({ key: spellingKey, state: { init: () => ({ hits, set: DecorationSet.empty, writing: true }), apply: (_t, v) => v } });
    const at = (pos: number) => EditorState.create({ doc: d, schema, plugins: [plugin], selection: TextSelection.create(d, pos) });
    expect(hits.map((h) => h.word)).toEqual(["bxd", "cyd", "dzd"]);
    expect(nextHit(at(1))).toMatchObject({ index: 1, total: 3, hit: { word: "cyd" } });
    expect(nextHit(at(10))).toMatchObject({ index: 2, hit: { word: "dzd" } });
    expect(nextHit(at(17))).toMatchObject({ index: 0, hit: { word: "bxd" } });
    const st = at(1);
    expect(hitAt(st, hits[0]!.pos + 1)?.word).toBe("bxd");
    expect(hitAt(st, hits[0]!.pos + 20)).toBeNull();
    expect(selectHit(st, hits[1]!).selection.from).toBe(hits[1]!.pos);
  });
  it("replaces a marked word with a suggestion", () => {
    const c = controller();
    const d = doc(para("rad bxd"));
    const st = stateOf(d);
    const [hit] = computeHits(d, c, true);
    expect(replaceHit(st, hit!, "dobar").doc.textContent).toBe("rad dobar");
  });
});

describe("on, off, adding to my dictionary, ignoring in this work", () => {
  it("toggles and remembers the switch; off marks nothing, on again marks again", async () => {
    const storage = mem();
    const c = new SpellingController({ workId: "w1", storage, load: async () => fake(["rad"]) });
    await c.ensureLoaded();
    expect(c.status).toBe("on");
    expect(toggleSpelling(c)).toBe("Pravopis je isključen.");
    expect(c.status).toBe("off");
    expect(new SpellingController({ workId: "w1", storage, load: async () => fake([]) }).status).toBe("off");
    expect(toggleSpelling(c)).toBe("Pravopis je uključen.");
    expect(c.status).toBe("on");
  });
  it("reports a failed load and retries when switched on again", async () => {
    let n = 0;
    const c = new SpellingController({ workId: "w", storage: mem(), load: async () => { if (n++ === 0) throw new Error("x"); return fake([]); } });
    await c.ensureLoaded();
    expect(c.status).toBe("fail");
    c.setEnabled(false);
    c.setEnabled(true);
    await c.ensureLoaded();
    expect(c.status).toBe("on");
  });
  it("adding to my dictionary lasts for every work, ignoring lasts only for one", () => {
    const storage = mem();
    const a = controller(["rad"], storage);
    a.addToMine("Bxd");
    a.ignoreInWork("cyd");
    const d = doc(para("bxd cyd rad zzz"));
    expect(computeHits(d, a, true).map((h) => h.word)).toEqual(["zzz"]);
    const sameWork = new SpellingController({ workId: "w1", storage, load: async () => fake([]) });
    const otherWork = new SpellingController({ workId: "w2", storage, load: async () => fake([]) });
    expect([...sameWork.knownWords].sort()).toEqual(["bxd", "cyd"]);
    expect([...otherWork.knownWords]).toEqual(["bxd"]);
  });
  it("notifies subscribers so the editor repaints", () => {
    const c = controller();
    let n = 0;
    const off = c.subscribe(() => n++);
    c.addToMine("abc");
    off();
    c.addToMine("abd");
    expect(n).toBe(1);
  });
  it("tells the menu what to show", () => {
    const c = controller();
    expect(menuState(c, null).note).toBe("bez za pogledati");
    c.setEnabled(false);
    expect(menuState(c, null)).toMatchObject({ note: "isključen", checked: false, next: null });
  });
});

describe("goToNext", () => {
  it("says so when the check is off", () => {
    const c = controller();
    c.setEnabled(false);
    expect(goToNext({} as never, c)).toBe("Pravopis nije uključen.");
  });
});
