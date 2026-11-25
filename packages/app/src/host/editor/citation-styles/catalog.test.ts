import { describe, expect, it } from "vitest";

import { formatInText, type Source } from "../../../../../editor-core/src/document/citation/index.ts";
import contracts from "../../../../../../src/client/migration-contracts.generated.json" with { type: "json" };
import { citationStyleOf, SERVER_STYLE_IDS, STYLE_IDS, styleNameOf } from "./catalog";

// All names are invented.
const book: Source = { type: "book", authors: [{ kind: "person", family: "Marić", given: "A." }], year: 2003, title: "Atlas izmišljenih općina", place: "Zagreb", publisher: "Izmišljena naklada" };

type Route = { responses: { "200": { content: { "application/json": { schema: { properties: { citationStyle: { anyOf: { const: string }[] } } } } } } } };
const route = (contracts as unknown as Record<string, Route>)["student.text-check-config.get"]!;
const serverIds = route.responses["200"].content["application/json"].schema.properties.citationStyle.anyOf.map((o) => o.const);

describe("citation style catalogue", () => {
  it("has a style for every id of the server catalogue except fusnote", () => {
    expect([...serverIds].sort()).toEqual([...SERVER_STYLE_IDS].sort());
    for (const id of serverIds.filter((i) => i !== "fusnote")) expect(citationStyleOf(id), id).not.toBeNull();
    expect(serverIds.filter((i) => citationStyleOf(i) === null)).toEqual(["fusnote"]);
  });

  it("gives null for fusnote, unknown ids and non-strings, also for prototype keys", () => {
    for (const id of ["fusnote", "mla", "", "FPZG", "__proto__", "constructor", "toString", undefined, null, 3, {}]) expect(citationStyleOf(id), String(id)).toBeNull();
  });

  it("keeps every style distinct, so a wrong file mapping would fail", () => {
    const cites = STYLE_IDS.map((id) => formatInText(book, citationStyleOf(id)!, "9"));
    expect(new Set(cites).size).toBe(STYLE_IDS.length);
  });

  it("names every style", () => {
    for (const id of STYLE_IDS) expect(styleNameOf(id).length).toBeGreaterThan(0);
  });
});
