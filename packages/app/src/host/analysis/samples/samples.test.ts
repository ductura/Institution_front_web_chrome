import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ANALYSIS_LIMITS, MAX_COLUMN_NAME_LENGTH } from "../api/limits";
import { parseDataset } from "../dataset/parse-csv";
import { sampleMessages as t } from "./messages.hr";
import { SamplePicker } from "./SamplePicker";
import { findSample, SAMPLES } from "./samples";

const HERE = dirname(fileURLToPath(import.meta.url));

// Patterns of personal data: none may appear in a cell or a header (the sets are invented, but a test keeps it so).
const FORBIDDEN_CELL: [string, RegExp][] = [
  ["e-mail", /@/],
  ["OIB (11 digits)", /\d{11}/],
  ["JMBAG (10 digits)", /\d{10}/],
  ["telephone", /(?:\+|00)\d{2,3}[\s/-]?\d/],
  ["URL", /https?:|www\./i],
  ["address", /\b(?:ulica|ul\.|cesta|trg)\b/i],
];
const FORBIDDEN_HEADER = /\b(?:ime|prezime|e-?mail|oib|jmbag|adresa|telefon|mobitel|korisnik|student|ispitanik|šifra|id)\b/i;

describe("invented sample sets", () => {
  it("has three sets with distinct ids and a title", () => {
    expect(SAMPLES).toHaveLength(3);
    expect(new Set(SAMPLES.map((sample) => sample.id)).size).toBe(3);
    for (const sample of SAMPLES) expect(sample.title).toMatch(/^Izmišljen/);
  });

  it.each(SAMPLES.map((sample) => [sample.id, sample] as const))("%s: text equals its CSV file", (id, sample) => {
    expect(sample.csv).toBe(readFileSync(join(HERE, `${id}.csv`), "utf8"));
  });

  it.each(SAMPLES.map((sample) => [sample.id, sample] as const))("%s: passes the reader and the limits", (_id, sample) => {
    const parsed = parseDataset(sample.csv);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const { columns, rows } = parsed.dataset;
    expect(rows.length).toBeGreaterThanOrEqual(40);
    expect(rows.length).toBeLessThanOrEqual(60);
    expect(rows.length).toBeLessThanOrEqual(ANALYSIS_LIMITS.maxRows);
    expect(columns.length).toBeLessThanOrEqual(ANALYSIS_LIMITS.maxColumns);
    for (const column of columns) expect(column.name.length).toBeLessThanOrEqual(MAX_COLUMN_NAME_LENGTH);
    expect(columns.some((column) => column.kind === "numeric")).toBe(true);
    expect(columns.some((column) => column.kind === "category")).toBe(true);
    expect(new TextEncoder().encode(JSON.stringify(parsed.dataset)).length).toBeLessThan(ANALYSIS_LIMITS.maxBodyBytes);
  });

  it.each(SAMPLES.map((sample) => [sample.id, sample] as const))("%s: has missing values and Croatian letters", (_id, sample) => {
    const parsed = parseDataset(sample.csv);
    if (!parsed.ok) throw new Error("expected a valid set");
    expect(parsed.dataset.rows.some((row) => row.includes(null))).toBe(true);
    expect(sample.csv).toMatch(/[čćšžđČĆŠŽĐ]/);
  });

  it.each(SAMPLES.map((sample) => [sample.id, sample] as const))("%s: no personal-data pattern and no identifying column", (_id, sample) => {
    const parsed = parseDataset(sample.csv);
    if (!parsed.ok) throw new Error("expected a valid set");
    for (const column of parsed.dataset.columns) expect(column.name, `header ${column.name}`).not.toMatch(FORBIDDEN_HEADER);
    for (const [label, pattern] of FORBIDDEN_CELL) {
      for (const line of sample.csv.split("\n")) expect(line, label).not.toMatch(pattern);
    }
    // No text column that is unique per row: it could name or identify a person.
    parsed.dataset.columns.forEach((column, index) => {
      if (column.kind !== "category") return;
      const values = parsed.dataset.rows.map((row) => row[index]).filter((value) => value !== null);
      expect(new Set(values).size, `column ${column.name}`).toBeLessThan(values.length / 2);
    });
  });

  it("the forbidden patterns do catch what they are meant to catch", () => {
    const hit = (text: string) => FORBIDDEN_CELL.some(([, pattern]) => pattern.test(text));
    expect(hit("ana.horvat@example.hr")).toBe(true);
    expect(hit("12345678901")).toBe(true);
    expect(hit("0123456789")).toBe(true);
    expect(hit("+385 91 123")).toBe(true);
    expect(hit("Ulica kneza Branimira")).toBe(true);
    expect(hit("Gradsko središte;Stan;2;Ne;6,3")).toBe(false);
    expect(FORBIDDEN_HEADER.test("Prezime")).toBe(true);
    expect(FORBIDDEN_HEADER.test("Biootpad kg tjedno")).toBe(false);
  });

  it("findSample answers for a known id and undefined for another", () => {
    expect(findSample("kompostiranje")?.title).toContain("kompostiranje");
    expect(findSample("../../etc/passwd")).toBeUndefined();
    expect(findSample("")).toBeUndefined();
  });

  it("the picker lists every set with a button and names the data as invented", () => {
    const html = renderToStaticMarkup(createElement(SamplePicker, { onLoaded: () => undefined }));
    for (const sample of SAMPLES) {
      expect(html).toContain(sample.title);
      expect(html).toContain(`${t.load}: ${sample.title}`);
    }
    expect(html).toContain("izmišljeni");
    expect(html.match(/<button/g)).toHaveLength(3);
  });
});
