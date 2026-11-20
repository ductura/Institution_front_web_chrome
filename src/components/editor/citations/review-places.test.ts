import { getSchema } from "@tiptap/core";
import { createEditorExtensionsV2 } from "@/editor";
import { expect, it } from "vitest";

import { reviewPlaces } from "./review-places";

const schema = getSchema(createEditorExtensionsV2());
const paragraph = (...text: string[]) => ({ type: "paragraph", content: text.map((text) => ({ type: "text", text })) });
const heading = (text: string) => ({ type: "heading", attrs: { level: 2 }, content: [{ type: "text", text }] });

it("finds live ranges and chapter numbers around formatting and inline citations", () => {
  const doc = schema.nodeFromJSON({ type: "doc", content: [
    paragraph("🌿 Prije uvoda [?]."), heading("Izmišljeno poglavlje"),
    { type: "paragraph", content: [
      { type: "citation", attrs: { sourceId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" } },
      { type: "text", text: " [iz", marks: [{ type: "bold" }] }, { type: "text", text: "vor] u opisu." },
    ] },
    heading("Sljedeće izmišljeno poglavlje"), paragraph("[stranica 17]"),
  ] });
  const places = reviewPlaces(doc);
  expect(places.map(({ chapter }) => chapter)).toEqual([undefined, "0.1", "0.2"]);
  expect(places.map(({ from, to }) => doc.textBetween(from, to))).toEqual(["[?]", "[izvor]", "[stranica 17]"]);
  expect(places[1]?.context).toBe("[izvor] u opisu.");
});

it("leaves ordinary brackets alone, and updates after a marker is replaced", () => {
  const doc = schema.nodeFromJSON({ type: "doc", content: [paragraph("[Uzorak] zanimljiv [?].")] });
  const place = reviewPlaces(doc)[0]!;
  const updated = doc.replace(place.from, place.to, doc.slice(place.from, place.from));
  expect(reviewPlaces(updated)).toEqual([]);
});
