import { describe, expect, it } from "vitest";
import { Schema, type Node as PmNode } from "@tiptap/pm/model";

import { findHints, hintsAt, HINT_KINDS, replacementFor, sentences, type Hint, type HintKind } from "./hints-model";
import { enabledHints, readTransOk } from "./hints-store";

const schema = new Schema({
  nodes: {
    doc: { content: "block+" },
    paragraph: { content: "inline*", group: "block" },
    heading: { content: "inline*", group: "block", attrs: { level: { default: 2 } } },
    text: { group: "inline" },
    citation: { inline: true, atom: true, group: "inline" },
  },
});
type Inline = ReturnType<typeof schema.text> | ReturnType<typeof schema.node>;
const p = (...c: (string | Inline)[]) => schema.node("paragraph", null, c.map((x) => (typeof x === "string" ? schema.text(x) : x)));
const h2 = (text: string) => schema.node("heading", { level: 2 }, [schema.text(text)]);
const cite = () => schema.node("citation");
const docOf = (...blocks: PmNode[]) => schema.node("doc", null, blocks);
const all = new Set<HintKind>(HINT_KINDS);
const only = (...kinds: HintKind[]) => new Set<HintKind>(kinds);
const textOf = (doc: PmNode, hint: Hint) => doc.textBetween(hint.from, hint.to, "", "￼");

describe("hints in the text (ED-82)", () => {
  it("underlines colloquial, absolute and first-person words with the prototype alternatives", () => {
    const doc = docOf(p("Ovo je jako važno. Rezultat uvijek vrijedi. Mislim da je tako."));
    const hints = findHints(doc, { enabled: only("colloq", "absolute", "first") });
    expect(hints.map((x) => [x.kind, textOf(doc, x)])).toEqual([["colloq", "jako"], ["absolute", "uvijek"], ["first", "Mislim"]]);
    expect(hints[0]).toMatchObject({ alts: ["vrlo", "izrazito"] });
    expect(findHints(doc, { enabled: only("claim") })).toEqual([]);
  });

  it("does not take a word inside a longer word", () => {
    expect(findHints(docOf(p("Puno ime, punoljetan student, superiornost.")), { enabled: only("colloq") }).map((x) => x.kind)).toEqual(["colloq"]);
  });

  it("asks a source for a claim without a citation, not for one with it", () => {
    const doc = docOf(p("Brojna istraživanja pokazuju učinak čitanja. Poznato je da djeca uče ", cite(), "."), p("Smatra se da (Izmišljena, 2021) vrijedi."));
    const claims = findHints(doc, { enabled: only("claim") });
    expect(claims.map((x) => textOf(doc, x))).toEqual(["Brojna istraživanja pokazuju učinak čitanja."]);
  });

  it("marks a sentence over 40 words as long", () => {
    const long = `${Array.from({ length: 41 }, (_, i) => `riječ${i}`).join(" ")}.`;
    const hints = findHints(docOf(p(`Kratka rečenica. ${long}`)), { enabled: only("long") });
    expect(hints).toHaveLength(1);
    expect(hints[0]!.from).toBeGreaterThan(17);
  });

  it("finds three passive sentences in a row, not two", () => {
    const three = "Upitnici su poslani poštom. Podaci su prikupljeni anketom. Rezultati su obrađeni ručno.";
    expect(findHints(docOf(p(three)), { enabled: only("passive") }).map((x) => x.kind === "passive" && x.n)).toEqual([3, 3, 3]);
    expect(findHints(docOf(p("Upitnici su poslani poštom. Podaci su prikupljeni anketom. Ja čitam.")), { enabled: only("passive") })).toEqual([]);
  });

  it("joins two short sentences that start with the same word", () => {
    const doc = docOf(p("Autor opisuje školu. Autor navodi primjere. Zatim slijedi nešto."));
    const [hint] = findHints(doc, { enabled: only("short") });
    expect(hint).toMatchObject({ kind: "short", first: "Autor", joined: "Autor opisuje školu i navodi primjere." });
    expect(textOf(doc, hint!)).toBe("Autor opisuje školu. Autor navodi primjere.");
  });

  it("flags an abbreviation once, before its full name, and keeps roman numerals and (ABC) quiet", () => {
    const doc = docOf(p("Prema EU pravilima i EU praksi."), p("Fakultet (FPZG) i dio II."));
    const hints = findHints(doc, { enabled: only("abbr") });
    expect(hints.map((x) => textOf(doc, x))).toEqual(["EU"]);
    const glossary = [{ term: "Europska unija (EU)", definition: "Zajednica država." }];
    expect(findHints(doc, { enabled: only("abbr"), glossary })[0]).toMatchObject({ ab: "EU", full: "Europska unija" });
  });

  it("finds a glossary term used before its definition, or never defined", () => {
    const glossary = [{ term: "pismenost", definition: "Sposobnost čitanja i pisanja." }];
    const early = docOf(p("Pismenosti ima malo."), p("Pismenost se definira kao vještina."));
    expect(findHints(early, { enabled: only("term"), glossary })).toMatchObject([{ kind: "term", sub: "early", term: "pismenost" }]);
    const never = docOf(p("Pismenost raste."), p("Pismenost pada."));
    expect(findHints(never, { enabled: only("term"), glossary })).toMatchObject([{ sub: "nodef", from: 1 }]);
  });

  it("asks for a transition between paragraphs with no shared stem or connective, unless accepted", () => {
    const doc = docOf(
      p("Školske knjižnice imaju malo novih naslova."),
      p("Roditelji navečer rijetko pričaju priče djeci."),
      p("Međutim, situacija se polako mijenja nabolje."),
      h2("Drugo poglavlje"),
      p("Posve drukčija tema otvara ovaj novi dio."),
    );
    const hints = findHints(doc, { enabled: only("trans") });
    expect(hints.map((x) => textOf(doc, x))).toEqual(["Roditelji navečer rijetko pričaju priče djeci."]);
    const key = (hints[0] as Extract<Hint, { kind: "trans" }>).key;
    expect(findHints(doc, { enabled: only("trans"), transOk: new Set([key]) })).toEqual([]);
  });

  it("opens the shortest hint at a place and keeps the capital of a replaced word", () => {
    const doc = docOf(p(`Jako ${Array.from({ length: 41 }, () => "riječ").join(" ")}.`));
    const hints = findHints(doc, { enabled: all });
    expect(hintsAt(hints, 2)[0]!.kind).toBe("colloq");
    expect(replacementFor(hintsAt(hints, 2)[0]!, "Jako", "vrlo")).toBe("Vrlo");
    expect(replacementFor(hintsAt(hints, 2)[0]!, "jako", "vrlo")).toBe("vrlo");
  });

  it("splits sentences as the prototype does", () => {
    expect(sentences("Prva. Druga! Treća").map((x) => x.s)).toEqual(["Prva.", "Druga!", "Treća"]);
  });

  it("follows the settings of the help dialog and keeps accepted transitions per work", () => {
    expect([...enabledHints({ enabled: ["paste", "claim", "long", "cmt"], level: "custom" })]).toEqual(["claim", "long"]);
    expect([...readTransOk({ getItem: () => JSON.stringify(["a", 3, "b"]) }, "k")]).toEqual(["a", "b"]);
    expect(readTransOk({ getItem: () => "{" }, "k").size).toBe(0);
  });
});
