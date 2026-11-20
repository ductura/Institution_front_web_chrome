import { describe, expect, it } from "vitest";
import { filterItems } from "./search";

const items = [
  { id: "1", label: "Izmišljeni vodič", description: "2026", keywords: "Ured Đ" },
  { id: "2", label: "Izmišljeni članci", description: "2024" },
];

describe("searchable list", () => {
  it("looks for every term in the label and metadata, regardless of order and diacritics", () => {
    expect(filterItems(items, "  2026  VODIC ured d ")).toEqual([items[0]]);
    expect(filterItems(items, "clanci 2026")).toEqual([]);
  });

  it("preserves the input list and order when no terms are entered", () => {
    expect(filterItems(items, "   ")).toBe(items);
    expect(filterItems([], "izvor")).toEqual([]);
  });
});
