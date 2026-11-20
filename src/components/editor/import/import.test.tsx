import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";

import { ImportTextDialog } from "./ImportTextDialog";
import { countWords, isRefusal, isTextFile, prepareImport, splitParagraphs, IMPORT_MAX_CHARS } from "./text-import";

const now = new Date("2026-11-20T10:00:00Z");

it("splits on blank lines and joins single line breaks", () => {
  expect(splitParagraphs("Prvi redak\nnastavak.\r\n\r\n\n  Drugi odlomak.  \n\n")).toEqual(["Prvi redak nastavak.", "Drugi odlomak."]);
  expect(splitParagraphs("  \n \n")).toEqual([]);
});

it("counts words with hyphens and Croatian letters", () => {
  expect(countWords(["Čaša vode, 3 plus-minus dva."])).toBe(5);
});

it("refuses without text, without declaration and over the limit", () => {
  expect(prepareImport("  ", true, now)).toBe("empty");
  expect(prepareImport("Izmišljeni tekst.", false, now)).toBe("needDeclaration");
  expect(prepareImport("a".repeat(IMPORT_MAX_CHARS + 1), true, now)).toBe("tooLarge");
});

it("returns the import with time and words once declared", () => {
  const result = prepareImport("Prvi odlomak.\n\nDrugi odlomak ovdje.", true, now);
  expect(isRefusal(result)).toBe(false);
  expect(result).toEqual({ paragraphs: ["Prvi odlomak.", "Drugi odlomak ovdje."], words: 5, importedAt: "2026-11-20T10:00:00.000Z", declared: true });
});

it("accepts only plain text files", () => {
  expect(isTextFile({ name: "rad.TXT", type: "text/plain" })).toBe(true);
  expect(isTextFile({ name: "bilješke.md", type: "" })).toBe(true);
  expect(isTextFile({ name: "rad.docx", type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" })).toBe(false);
  expect(isTextFile({ name: "skripta.txt", type: "application/x-sh" })).toBe(false);
});

it("renders the notice, the declaration and the file input", () => {
  const html = renderToStaticMarkup(<ImportTextDialog onImport={() => {}} onClose={() => {}} />);
  expect(html).toContain("Uvoz postojećeg teksta");
  expect(html).toContain("Potvrđujem da je ovo moj tekst");
  expect(html).toContain('accept=".txt,.md,text/plain,text/markdown"');
  expect(html).toContain("Uvezi na kraj rada");
});
