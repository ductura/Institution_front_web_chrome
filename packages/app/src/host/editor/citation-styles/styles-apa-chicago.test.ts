import { describe, expect, it } from "vitest";

import {
  assignYearSuffixes,
  CitationInputError,
  CitationStyleError,
  formatBibliographyEntry,
  formatInText,
  parseCitationStyle,
  sortBibliography,
  type Person,
  type Source,
} from "../../../../../editor-core/src/document/citation/index.ts";
import apaFile from "../../../../../../config/citation-styles/apa.json";
import chicagoFile from "../../../../../../config/citation-styles/chicago.json";
import fpzgFile from "../../../../../../config/faculties/fpzg/citation.json";

// All people, titles and publishers are invented.
const apa = parseCitationStyle(apaFile);
const chicago = parseCitationStyle(chicagoFile);

const p = (family: string, given: string): Person => ({ kind: "person", family, given });
const horvat = p("Horvat", "Ana");
const kovac = p("Kovač", "Marko");
const babic = p("Babić", "Iva");
const maric = p("Marić", "Petra");

const book: Source = { type: "book", authors: [p("Marić", "A.")], year: 2003, title: "Politički marketing", place: "Zagreb", publisher: "Izmišljena naklada" };
const article: Source = { type: "article", authors: [horvat], year: 2019, title: "Mala javna politika", journal: "Izmišljeni časopis", volume: "12", issue: "3", pages: "45-60" };
const chapter: Source = { type: "chapter", authors: [kovac], year: 2021, title: "Lokalna uprava", editors: [horvat, babic], bookTitle: "Zbornik o upravi", place: "Split", publisher: "Probna naklada", pages: "10-24" };
const web: Source = { type: "web", authors: [{ kind: "organization", name: "Izmišljeni institut", acronym: "IZI" }], year: 2022, title: "Godišnje izvješće", url: "https://primjer.invalid/izvjesce", accessed: "2026-11-24" };

describe("style files are valid and distinct", () => {
  it("parse and keep their own ids", () => {
    expect(apa.faculty).toBe("apa");
    expect(chicago.faculty).toBe("chicago");
    expect(apa.style).toBe("author-date");
    expect(chicago.style).toBe("author-date");
  });

  it("differ from each other and from FPZG, so a wrong file mapping would fail", () => {
    const fpzg = parseCitationStyle(fpzgFile);
    const cites = [apa, chicago, fpzg].map((s) => formatInText(book, s, "9"));
    expect(new Set(cites).size).toBe(3);
  });

  it("carry provenance and only derived rules (not claimed as confirmed)", () => {
    for (const file of [apaFile, chicagoFile]) {
      expect(file.provenance.sourceWork.length).toBeGreaterThan(10);
      expect(file.provenance.verifiedWith).toMatch(/nije potvrđeno/);
      expect(file.rules.length).toBeGreaterThan(5);
      for (const rule of file.rules) expect(rule.status).toBe("derived");
    }
  });
});

describe("APA in-text", () => {
  it("formats with comma, str. and en dash", () => {
    expect(formatInText(book, apa)).toBe("(Marić, 2003)");
    expect(formatInText(book, apa, "9")).toBe("(Marić, 2003, str. 9)");
    expect(formatInText(book, apa, "9-12")).toBe("(Marić, 2003, str. 9–12)");
  });
  it("uses „i” for two authors and „i sur.” from three", () => {
    expect(formatInText({ ...book, authors: [horvat, kovac] }, apa)).toBe("(Horvat i Kovač, 2003)");
    expect(formatInText({ ...book, authors: [horvat, kovac, babic] }, apa)).toBe("(Horvat i sur., 2003)");
  });
  it("uses the acronym for an organisation", () => {
    expect(formatInText(web, apa)).toBe("(IZI, 2022)");
  });
});

describe("APA bibliography", () => {
  it("book", () => {
    expect(formatBibliographyEntry(book, apa)).toBe("Marić, A. (2003). Politički marketing. Zagreb: Izmišljena naklada.");
  });
  it("article, chapter, web", () => {
    expect(formatBibliographyEntry(article, apa)).toBe("Horvat, Ana (2019). Mala javna politika. Izmišljeni časopis 12/3: 45–60.");
    expect(formatBibliographyEntry(chapter, apa)).toBe(
      "Kovač, Marko (2021). Lokalna uprava. U: Ana Horvat i Iva Babić (ur.) Zbornik o upravi. Split: Probna naklada: 10–24.",
    );
    expect(formatBibliographyEntry(web, apa)).toBe(
      "IZI (Izmišljeni institut) (2022). Godišnje izvješće. https://primjer.invalid/izvjesce (pristupljeno 24. 11. 2026.)",
    );
  });
  it("joins authors with „i”", () => {
    expect(formatBibliographyEntry({ ...book, authors: [horvat, kovac] }, apa)).toContain("Horvat, Ana i Kovač, Marko (2003).");
  });
});

describe("Chicago in-text", () => {
  it("formats without comma before the year and without str.", () => {
    expect(formatInText(book, chicago)).toBe("(Marić 2003)");
    expect(formatInText(book, chicago, "9")).toBe("(Marić 2003, 9)");
    expect(formatInText(book, chicago, "9-12")).toBe("(Marić 2003, 9–12)");
  });
  it("names up to three authors, then „i sur.”", () => {
    expect(formatInText({ ...book, authors: [horvat, kovac] }, chicago)).toBe("(Horvat i Kovač 2003)");
    expect(formatInText({ ...book, authors: [horvat, kovac, babic] }, chicago)).toBe("(Horvat, Kovač i Babić 2003)");
    expect(formatInText({ ...book, authors: [horvat, kovac, babic, maric] }, chicago)).toBe("(Horvat i sur. 2003)");
  });
});

describe("Chicago bibliography", () => {
  it("book, article, chapter, web", () => {
    expect(formatBibliographyEntry({ ...book, authors: [p("Marić", "Ana")] }, chicago)).toBe(
      "Marić, Ana (2003). Politički marketing. Zagreb: Izmišljena naklada.",
    );
    expect(formatBibliographyEntry(article, chicago)).toBe("Horvat, Ana (2019). Mala javna politika. Izmišljeni časopis 12/3: 45–60.");
    expect(formatBibliographyEntry(chapter, chicago)).toContain("U: Ana Horvat i Iva Babić (ur.) Zbornik o upravi.");
    expect(formatBibliographyEntry(web, chicago)).toContain("(pristupljeno 24. 11. 2026.)");
  });
});

describe("shared behaviour with the new styles", () => {
  it("sorts alphabetically with Croatian collation and suffixes same-year works", () => {
    const a: Source = { ...book, authors: [p("Šiber", "Ivan")], year: 2013, title: "B naslov" };
    const b: Source = { ...a, title: "A naslov" };
    const c: Source = { ...book, authors: [p("Čorić", "Ema")] };
    const families = sortBibliography([a, c]).map((s) => (s.authors[0]?.kind === "person" ? s.authors[0].family : ""));
    expect(families).toEqual(["Čorić", "Šiber"]);
    const [first, second] = assignYearSuffixes([a, b]);
    expect(formatInText(first as Source, apa)).toBe("(Šiber, 2013b)");
    expect(formatInText(second as Source, chicago)).toBe("(Šiber 2013a)");
  });

  it("refuses bad input", () => {
    expect(() => formatInText({ ...book, authors: [] }, apa)).toThrow(CitationInputError);
    expect(() => formatBibliographyEntry({ ...web, accessed: "2026-02-31" }, chicago)).toThrow(CitationInputError);
  });
});

describe("invalid style files fail closed", () => {
  const without = (file: Record<string, unknown>, key: string) => {
    const copy = structuredClone(file);
    delete copy[key];
    return copy;
  };
  for (const [name, file] of [["apa", apaFile], ["chicago", chicagoFile]] as const) {
    it(`${name}: missing section, wrong style, bad max authors`, () => {
      expect(() => parseCitationStyle(without(file, "inText"))).toThrow(CitationStyleError);
      expect(() => parseCitationStyle(without(file, "rangeDash"))).toThrow(CitationStyleError);
      expect(() => parseCitationStyle({ ...file, style: "ieee" })).toThrow(CitationStyleError);
      expect(() => parseCitationStyle({ ...file, inText: { ...file.inText, maxNamedAuthors: 0 } })).toThrow(CitationStyleError);
      expect(() => parseCitationStyle({ ...file, bibliography: { ...file.bibliography, periodAfterYear: "da" } })).toThrow(CitationStyleError);
      expect(() => parseCitationStyle(null)).toThrow(CitationStyleError);
    });
  }
});

describe("rule examples in the files agree with the formatter", () => {
  it("APA book example", () => {
    const ex = apaFile.rules.find((r) => r.id === "book")?.examples?.[0];
    expect(ex).toBe(formatBibliographyEntry(book, apa));
  });
  it("APA/Chicago in-text examples", () => {
    expect(apaFile.rules.find((r) => r.id === "in-text")?.examples).toContain(formatInText({ ...book, authors: [p("Becker", "X")], year: 2007 }, apa, "9"));
    expect(chicagoFile.rules.find((r) => r.id === "in-text")?.examples).toContain(formatInText({ ...book, authors: [p("Becker", "X")], year: 2007 }, chicago, "9"));
  });
});
