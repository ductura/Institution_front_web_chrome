import { Schema } from "@tiptap/pm/model";
import { describe, expect, it } from "vitest";

import { rehearsalSupplements, selectedLabel, uncitedSources } from "./status-model";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const schema = new Schema({
  nodes: {
    doc: { content: "paragraph+", attrs: { sources: { default: [] } } },
    paragraph: { content: "inline*" },
    text: { group: "inline" },
    citation: { group: "inline", inline: true, atom: true, attrs: { sourceId: { default: null }, locator: { default: null } } },
  },
});
const source = (id: string, family: string) => ({ id, year: 2020, authors: [{ kind: "person", family }] });
const docOf = (sources: object[], cited: string[]) => schema.node("doc", { sources }, [
  schema.node("paragraph", null, cited.map((sourceId) => schema.node("citation", { sourceId }))),
]);

describe("selectedLabel", () => {
  it("is empty for a caret and counts words otherwise", () => {
    expect(selectedLabel(0)).toBeNull();
    expect(selectedLabel(1)).toBe("označeno: 1 riječ");
    expect(selectedLabel(12)).toBe("označeno: 12 riječi");
  });
});

describe("uncited sources", () => {
  it("counts sources without a citation", () => {
    expect(uncitedSources(docOf([source(A, "Kovač"), source(B, "Horvat")], [A]))).toEqual({ total: 2, uncited: 1 });
  });
  it("gives a row per state and 'unavailable' for what has no source yet", () => {
    const all = rehearsalSupplements(docOf([source(A, "Kovač")], [A]));
    expect(all.uncited?.detail).toBe("Svi izvori su citirani.");
    expect(rehearsalSupplements(docOf([source(A, "Kovač"), source(B, "Horvat")], [A])).uncited?.detail).toBe("Necitirano: 1.");
    expect(rehearsalSupplements(docOf([], [])).uncited?.detail).toBe("Još nema izvora u radu.");
    expect(rehearsalSupplements(null).uncited?.detail).toBe("Podatak trenutačno nije dostupan.");
    expect(all.facultyRequirements?.detail).toBe("Podatak trenutačno nije dostupan.");
    expect(all.proofs?.detail).toBe("Podatak trenutačno nije dostupan.");
    expect(all.forms?.detail).toBe("Podatak trenutačno nije dostupan.");
  });
});
