// ED-38: citations with a requested confirmation are a line in the "Uz tekst" alert row (prune.js ctxAlerts).
import { Schema } from "@tiptap/pm/model";
import { describe, expect, it } from "vitest";

import { needProofPlaces } from "./marks-model";
import { marksHr as t } from "./messages.hr";

const schema = new Schema({
  nodes: {
    doc: { content: "paragraph+" },
    paragraph: { content: "inline*", group: "block" },
    text: { group: "inline" },
    citation: { inline: true, atom: true, group: "inline", attrs: { sourceId: { default: "s" }, rq: { default: null } } },
  },
});

describe("the requested-confirmation line of the alert row", () => {
  it("counts only citations with a request, as the prototype's wording says", () => {
    const doc = schema.node("doc", null, [schema.node("paragraph", null, [
      schema.text("A "), schema.node("citation", { rq: "r1" }), schema.text(" b "), schema.node("citation"), schema.node("citation", { rq: "r2" }),
    ])]);
    expect(needProofPlaces(doc)).toHaveLength(2);
    expect(t.needAlert(1)).toBe("Mentor traži potvrdu uz 1 navod");
    expect(t.needAlert(2)).toBe("Mentor traži potvrdu uz 2 navoda");
    expect(t.needAlert(5)).toBe("Mentor traži potvrdu uz 5 navoda");
  });
});
