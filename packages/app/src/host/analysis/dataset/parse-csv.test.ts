import { describe, expect, it } from "vitest";

import { ANALYSIS_LIMITS } from "../api/limits";
import { describeError } from "./describe-error";
import { parseDataset, type DatasetError } from "./parse-csv";

// Invented data only: a made-up composting survey, no real person.
const GOOD = "Kućanstvo;Osobe;Otpad kg\nA;3;12,5\nB;2;8,25\nC;4;\n";

const errorsOf = (text: string): DatasetError[] => {
  const parsed = parseDataset(text);
  if (parsed.ok) throw new Error("expected a refusal");
  return parsed.errors;
};

describe("parseDataset", () => {
  it("reads a correct set: kinds, numbers and an empty cell as null", () => {
    const parsed = parseDataset(GOOD);
    expect(parsed).toEqual({
      ok: true,
      dataset: {
        columns: [
          { name: "Kućanstvo", kind: "category" },
          { name: "Osobe", kind: "numeric" },
          { name: "Otpad kg", kind: "numeric" },
        ],
        rows: [["A", 3, 12.5], ["B", 2, 8.25], ["C", 4, null]],
      },
    });
  });

  it("ignores a BOM and reads CRLF and a missing final newline", () => {
    expect(parseDataset(`﻿${GOOD.replaceAll("\n", "\r\n").trimEnd()}`)).toEqual(parseDataset(GOOD));
  });

  it("takes ; or , as the separator and gives the same set", () => {
    const comma = parseDataset('Kućanstvo,Osobe,Otpad kg\nA,3,"12,5"\nB,2,"8,25"\nC,4,\n');
    expect(comma).toEqual(parseDataset(GOOD));
  });

  it("reads a decimal point and a decimal comma, and -0 as 0", () => {
    const parsed = parseDataset("x;y\n1,5;-0\n2.25;3");
    expect(parsed.ok && parsed.dataset.rows).toEqual([[1.5, 0], [2.25, 3]]);
    expect(parsed.ok && Object.is(parsed.dataset.rows[0]![1], 0)).toBe(true);
  });

  it("reads RFC 4180 quotes: separator, doubled quote and a line break inside a cell", () => {
    const parsed = parseDataset('Naziv;Bilješka\n"a;b";"kaže ""da"""\nc;"dva\nretka"');
    expect(parsed.ok && parsed.dataset.rows).toEqual([["a;b", 'kaže "da"'], ["c", "dva\nretka"]]);
  });

  it("refuses a quote that does not close or sits inside a cell", () => {
    expect(errorsOf('a;b\n"x;1')[0]?.code).toBe("unterminatedQuote");
    expect(errorsOf('a;b\nx"y;1')[0]?.code).toBe("badQuote");
    expect(errorsOf('a;b\n"x"y;1')[0]?.code).toBe("badQuote");
  });

  it("refuses an empty file and text of blanks", () => {
    expect(errorsOf("")).toEqual([{ code: "empty" }]);
    expect(errorsOf("  \n \r\n")).toEqual([{ code: "empty" }]);
    expect(errorsOf("﻿")).toEqual([{ code: "empty" }]);
  });

  it("refuses a file without a header and a header without rows", () => {
    expect(errorsOf("1;2;3\n4;5;6")).toEqual([{ code: "noHeader" }]);
    expect(errorsOf("a;b;c\n")).toEqual([{ code: "noRows" }]);
  });

  it("takes 500 rows and refuses the 501st", () => {
    const rows = (n: number) => Array.from({ length: n }, (_, i) => `r${i};${i}`).join("\n");
    expect(parseDataset(`a;b\n${rows(ANALYSIS_LIMITS.maxRows)}`).ok).toBe(true);
    expect(errorsOf(`a;b\n${rows(ANALYSIS_LIMITS.maxRows + 1)}`)).toEqual([{ code: "tooManyRows", row: 501 }]);
  });

  it("takes 12 columns and refuses the 13th", () => {
    const header = (n: number) => Array.from({ length: n }, (_, i) => `s${i}`).join(";");
    const row = (n: number) => Array.from({ length: n }, (_, i) => String(i)).join(";");
    expect(parseDataset(`${header(12)}\n${row(12)}`).ok).toBe(true);
    expect(errorsOf(`${header(13)}\n${row(13)}`)).toEqual([{ code: "tooManyColumns", column: 13 }]);
  });

  it("refuses a duplicate, an empty and a too long column name, by column", () => {
    expect(errorsOf("a;b;a\n1;2;3")).toEqual([{ code: "duplicateName", column: 3, name: "a" }]);
    expect(errorsOf("a;;c\n1;2;3")).toEqual([{ code: "emptyName", column: 2 }]);
    expect(errorsOf(`${"n".repeat(41)};b\n1;2`)[0]).toMatchObject({ code: "nameTooLong", column: 1 });
  });

  it("refuses a column that mixes numbers and text, at the odd cell", () => {
    expect(errorsOf("grupa;vrijednost\nA;1\nB;2\nC;tri\nD;4")).toEqual([{ code: "mixedType", row: 3, column: 2, name: "vrijednost" }]);
  });

  it("does not take 1,234.5 or 1e3 as numbers", () => {
    expect(errorsOf('x\n"1,234.5"\n2')[0]?.code).toBe("mixedType");
    expect(errorsOf("x\n1e3\n2")[0]?.code).toBe("mixedType");
  });

  it("refuses a row with the wrong number of cells, by row", () => {
    expect(errorsOf("a;b;c\n1;2;3\n4;5")).toEqual([{ code: "cellCount", row: 2, column: 3 }]);
    expect(errorsOf("a;b\n1;2;3")).toEqual([{ code: "cellCount", row: 1, column: 3 }]);
  });

  it("refuses a category cell over 64 characters", () => {
    expect(errorsOf(`g;n\n${"x".repeat(65)};1`)[0]).toMatchObject({ code: "cellTooLong", row: 1, column: 1 });
    expect(parseDataset(`g;n\n${"x".repeat(64)};1`).ok).toBe(true);
  });

  it("refuses text longer than the reader takes and a set over the body limit", () => {
    expect(errorsOf("a\n" + "1\n".repeat(600_000))).toEqual([{ code: "tooLong" }]);
    // 12 columns of 64 characters x 150 rows is about 150 kB of JSON, over the 131072 bytes of a body.
    const wide = Array.from({ length: 12 }, (_, i) => `s${i}`).join(";");
    const row = Array.from({ length: 12 }, (_, i) => `${i}`.padEnd(64, "ž")).join(";");
    expect(errorsOf(`${wide}\n${Array(150).fill(row).join("\n")}`)).toEqual([{ code: "bodyTooLarge" }]);
  });

  it("never throws on odd input", () => {
    for (const text of ['"', ";;;", "\n\n\na", '""', "a;b\n;", "\u0000", '"a"b"', "a b"]) {
      expect(() => parseDataset(text), text).not.toThrow();
    }
  });
});

describe("describeError", () => {
  it("names row and column in Croatian", () => {
    expect(describeError({ code: "mixedType", row: 3, column: 2, name: "vrijednost" })).toBe("Redak 3, stupac 2: Stupac “vrijednost” miješa brojeve i tekst.");
    expect(describeError({ code: "tooManyRows", row: 501 })).toBe("Redak 501: Najviše je 500 redaka.");
    expect(describeError({ code: "tooManyColumns", column: 13 })).toBe("Stupac 13: Najviše je 12 stupaca.");
    expect(describeError({ code: "empty" })).toBe("Nema podataka: datoteka ili tekst su prazni.");
  });
});
