import { describe, expect, it } from "vitest";
import { readSource, type SourceType } from "./source-fields";

const common = { "authors.0.kind": "organization", "authors.0.name": "Izmišljeni ured", year: "2026", title: "Izmišljeni rad" };

function read(type: SourceType, fields: Record<string, string>) {
  const data = new FormData();
  for (const [name, value] of Object.entries({ ...common, ...fields })) data.set(name, value);
  return readSource(type, data);
}

describe("source fields", () => {
  it.each([
    ["book", { place: "Izmišljeni grad", publisher: "Izmišljeni nakladnik" }],
    ["article", { journal: "Izmišljeni časopis", pages: "12–15" }],
    ["chapter", { bookTitle: "Izmišljena knjiga", place: "Izmišljeni grad", publisher: "Izmišljeni nakladnik",
      "editors.0.family": "Urednik A", "editors.0.given": "Demo" }],
    ["web", { url: "https://izvor.example/", accessed: "2024-02-29" }],
  ] as const)("reads a %s with only fields of that type", (type, fields) => {
    const result = read(type, { ...fields, volume: "", unrelated: "Izmišljeno" });
    expect(result.errors).toBeUndefined();
    expect(result.draft).toMatchObject({ type, year: 2026, authors: [{ kind: "organization", name: "Izmišljeni ured" }] });
    expect(result.draft).not.toHaveProperty("unrelated");
    expect(result.draft).not.toHaveProperty("volume");
  });

  it("reports invalid fields by name", () => {
    const result = read("web", { title: "\u202eIzmišljeno", year: "2026.5", url: "https://", accessed: "2026-02-29", "authors.0.name": "  " });
    expect(result.draft).toBeUndefined();
    expect(Object.keys(result.errors ?? {})).toEqual(["authors.0.name", "year", "title", "url", "accessed"]);
  });
});
