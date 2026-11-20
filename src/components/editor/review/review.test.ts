import { Schema } from "@tiptap/pm/model";
import { describe, expect, it } from "vitest";

import { knownCheckIds, runChecks, sentencesOf } from "./checks";
import { digestOf } from "./digest";
import { ignore, readIgnored, restore, splitIgnored, writeIgnored } from "./ignored";
import { readReviewDoc, reviewDocOf, type BlockInput } from "./model";
import { inScope, validScope } from "./scope";
import { detailOf, digestText, rowsOf, summaryLine } from "./view";

const h = (text: string, level = 1, id = `h-${text}`): BlockInput => ({ kind: "heading", text, level, id });
const p = (text: string, id: string, citations = 0): BlockInput => ({ kind: "paragraph", text, id, citations });
const words = (n: number) => Array.from({ length: n }, (_, i) => `riječ${"abcdefghij"[i % 10]}`).join(" ");

const work = reviewDocOf([
  h("Uvod"), p("Cilj rada je opisati kućno kompostiranje u izmišljenom gradu i pokazati kako ga uvesti u svako kućanstvo.", "u1"),
  h("Analiza"),
  h("Podaci", 2),
  p("U gradu živi 12 000 stanovnika i 40% njih kompostira.", "a1"),
  p("Kompostiranje je uvijek najbolje rješenje.  Mislim da je to jasno ,jer je ovo super.", "a2"),
  h("Zaključak"),
  p("Analiza je pokazala da H1 vrijedi. Druga rečenica je ovdje. Treća se ne prikazuje.", "z1"),
]);

describe("which checks run", () => {
  it("drops ids this build does not know and runs all when no list was read", () => {
    expect(knownCheckIds(["num", "nepoznato", "long"])).toEqual(["num", "long"]);
    expect(runChecks(work, null).length).toBeGreaterThan(0);
    expect(runChecks(work, []).length).toBe(0);
    expect(runChecks(work, ["nepoznato"]).length).toBe(0);
  });

  it("runs only the enabled kinds", () => {
    const kinds = new Set(runChecks(work, ["num", "colloq"]).map((f) => f.kind));
    expect([...kinds].sort()).toEqual(["colloq", "num"]);
  });
});

describe("the checks", () => {
  const only = (id: string, inputs: BlockInput[]) => runChecks(reviewDocOf(inputs), [id]);

  it("finds a number without a citation, not one with a citation or a year", () => {
    expect(only("num", [p("Prihod je bio 40% veći.", "a")])).toHaveLength(1);
    expect(only("num", [{ kind: "paragraph", text: "Prihod je bio 40% veći.\uFFFC", id: "a", citations: 1 }])).toHaveLength(0);
    expect(only("num", [p("Prihod je bio 40% veći (Autor 2020: 12).", "a")])).toHaveLength(0);
    expect(only("num", [p("Godine 1999. dogodilo se ovo.", "a")])).toHaveLength(0);
    expect(only("num", [p("Prihod je 40% veći. Isto vrijedi za sljedeće.", "a")])).toHaveLength(0);
    expect(only("num", [{ kind: "quote", text: "Prihod je 40% veći.", id: "q" }])).toHaveLength(0);
  });

  it("finds a long sentence and a short paragraph", () => {
    expect(only("long", [p(`${words(45)}.`, "a")])).toHaveLength(1);
    expect(only("long", [p(`${words(10)}.`, "a")])).toHaveLength(0);
    expect(only("short", [p("Kratko.", "a")])).toHaveLength(1);
    expect(only("short", [p(words(20), "a")])).toHaveLength(0);
  });

  it("finds colloquial, absolute and first person words as whole words only", () => {
    expect(only("colloq", [p("To je super ideja.", "a")])).toHaveLength(1);
    expect(only("colloq", [p("Superiorna analiza.", "a")])).toHaveLength(0);
    expect(only("absolute", [p("To je uvijek tako.", "a")])).toHaveLength(1);
    expect(only("first", [p("Mislim da je tako.", "a")])).toHaveLength(1);
  });

  it("finds three passives in a row", () => {
    expect(only("passive", [p("Podatak je prikupljen. Uzorak je odabran. Tekst je napisan.", "a")])).toHaveLength(1);
    expect(only("passive", [p("Podatak je prikupljen. Uzorak je odabran.", "a")])).toHaveLength(0);
  });

  it("finds marks left for later as required, everything else as advice", () => {
    const found = runChecks(reviewDocOf([p("Navod [?] je ostavljen. To je super.", "a")]), null);
    expect(found.find((f) => f.kind === "hole")?.severity).toBe("required");
    expect(found.filter((f) => f.kind !== "hole").every((f) => f.severity === "advisory")).toBe(true);
  });

  it("finds small writing slips", () => {
    const notes = only("fix", [p("Dva  razmaka ,zarez i \"ravni\" navodnici.", "a")]).map((f) => f.note);
    expect(notes).toEqual(expect.arrayContaining(["spaces", "before", "after", "quotes"]));
    expect(only("fix", [p("Sve je uredno, kako treba.", "a")])).toHaveLength(0);
  });

  it("finds references to chapters that do not exist and structure problems", () => {
    const doc = reviewDocOf([h("Uvod"), p("Vidi poglavlje 7.2 za više. U prethodnom poglavlju se vidi.", "u"), h("Rad"), h("Jedini", 2), h("Zaključak", 1)]);
    const notes = runChecks(doc, ["ref", "str"]).map((f) => `${f.kind}:${f.note}`);
    expect(notes).toEqual(expect.arrayContaining(["ref:missing:7.2", "ref:first", "str:single", "str:empty"]));
  });

  it("gives every finding a stable id that does not depend on an index of the list", () => {
    const first = runChecks(work, null);
    expect(new Set(first.map((f) => f.id)).size).toBe(first.length);
    expect(runChecks(work, null).map((f) => f.id)).toEqual(first.map((f) => f.id));
  });
});

describe("scope", () => {
  const all = runChecks(work, null);
  it("keeps the findings of the whole work or of one chapter with its subchapters", () => {
    const analysis = work.chapters.find((c) => c.title === "Analiza")!;
    const inAnalysis = all.filter((f) => inScope(work, { kind: "chapter", id: analysis.id! }, f));
    expect(inAnalysis.length).toBeGreaterThan(0);
    expect(inAnalysis.length).toBeLessThan(all.length);
    expect(inAnalysis.every((f) => f.blockId === "a1" || f.blockId === "a2" || f.blockId === "h-Podaci" || f.blockId === "h-Analiza")).toBe(true);
    expect(all.every((f) => inScope(work, { kind: "all" }, f))).toBe(true);
  });

  it("falls back to the whole work when the chapter is gone", () => {
    expect(validScope(work, { kind: "chapter", id: "nema" })).toEqual({ kind: "all" });
  });
});

describe("ignored findings", () => {
  const all = runChecks(work, null);
  it("hides a marked finding and brings it back", () => {
    const key = all[0]!.key;
    const marked = ignore([], key);
    expect(splitIgnored(all, marked).open).not.toContainEqual(expect.objectContaining({ key }));
    expect(splitIgnored(all, marked).ignored.map((f) => f.key)).toContain(key);
    expect(splitIgnored(all, restore(marked, key)).ignored).toHaveLength(0);
    expect(ignore(marked, key)).toEqual(marked);
  });

  it("keeps the mark per work and survives broken storage", () => {
    const mem = new Map<string, string>();
    const storage = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v) };
    writeIgnored(storage, "w1", ["a|b"]);
    expect(readIgnored(storage, "w1")).toEqual(["a|b"]);
    expect(readIgnored(storage, "w2")).toEqual([]);
    mem.set("ductura.pregled.zanemareno.v1.w3", "{pokvareno");
    expect(readIgnored(storage, "w3")).toEqual([]);
    expect(readIgnored(null, "w1")).toEqual([]);
    expect(() => writeIgnored({ setItem: () => { throw new Error("full"); } }, "w1", ["x"])).not.toThrow();
  });
});

describe("the summary follows the text", () => {
  const before = digestOf(work, runChecks(work, null));
  it("reads title, structure, hypotheses and the start of the conclusion", () => {
    expect(before.title).toBe("Uvod");
    expect(before.rows.map((r) => r.number)).toEqual(["1", "2", "2.1", "3"]);
    expect(before.hypotheses).toEqual(["H1"]);
    expect(before.conclusion).toBe("Analiza je pokazala da H1 vrijedi. Druga rečenica je ovdje.");
  });

  it("changes when the text changes", () => {
    const edited = reviewDocOf([h("Uvod"), p("Kratko.", "u1"), h("Zaključak"), p("Nema više.", "z1")]);
    const after = digestOf(edited, runChecks(edited, null));
    expect(after.words).toBeLessThan(before.words);
    expect(after.hypotheses).toEqual([]);
    expect(after.conclusion).toBe("Nema više.");
    expect(after.rows).toHaveLength(2);
  });

  it("counts only the findings the student has not marked", () => {
    const found = runChecks(work, null);
    const { open } = splitIgnored(found, [found[0]!.key]);
    expect(digestOf(work, open).open).toBe(open.length);
    expect(open.length).toBeLessThan(found.length);
  });

  it("is plain text with every part", () => {
    const text = digestText(before, { question: "Kako uvesti kompostiranje?", wordRange: { min: 100, max: 200 } });
    expect(text).toContain("Kako uvesti kompostiranje?");
    expect(text).toContain("traži se 100 do 200");
    expect(text).toContain("H1");
    expect(digestText(digestOf(reviewDocOf([]), []))).toContain("nije upisano");
  });
});

describe("the list rows", () => {
  it("shows advice as advice and says what was found", () => {
    const rows = rowsOf(runChecks(work, null));
    expect(rows.some((r) => r.severity === "advisory")).toBe(true);
    expect(rows.every((r) => r.title !== "" && (r.detail ?? "") !== "" && r.actions.length === 2)).toBe(true);
    expect(runChecks(work, null).every((f) => detailOf(f) !== "")).toBe(true);
  });

  it("counts in the scope", () => {
    expect(summaryLine(0, false)).toBe("Nema napomena u tekstu.");
    expect(summaryLine(3, true)).toBe("3 za pogledati u ovom poglavlju.");
    expect(sentencesOf("Prva. Druga? Treća!")).toHaveLength(3);
  });
});

describe("reading the editor document", () => {
  const schema = new Schema({
    nodes: {
      doc: { content: "block+" },
      text: { group: "inline" },
      citation: { group: "inline", inline: true, atom: true },
      heading: { group: "block", content: "inline*", attrs: { level: { default: 1 }, nodeId: { default: null } } },
      paragraph: { group: "block", content: "inline*", attrs: { nodeId: { default: null } } },
    },
  });
  it("reads headings, text, citations and positions as the editor holds them", () => {
    const doc = schema.node("doc", null, [
      schema.node("heading", { level: 1, nodeId: "h1" }, [schema.text("Uvod")]),
      schema.node("paragraph", { nodeId: "p1" }, [schema.text("Prihod je 40% veći"), schema.node("citation"), schema.text(".")]),
      schema.node("heading", { level: 2, nodeId: "h2" }, [schema.text("Podaci")]),
    ]);
    const model = readReviewDoc(doc);
    expect(model.chapters.map((c) => [c.number, c.id, c.title])).toEqual([["1", "h1", "Uvod"], ["1.1", "h2", "Podaci"]]);
    expect(model.blocks.map((b) => [b.id, b.kind, b.citations, b.chapter])).toEqual([["h1", "heading", 0, 0], ["p1", "paragraph", 1, 0], ["h2", "heading", 0, 1]]);
    expect(model.blocks[1]!.pos).toBe(doc.child(0).nodeSize);
    expect(runChecks(model, ["num"])).toHaveLength(0);
  });
});
