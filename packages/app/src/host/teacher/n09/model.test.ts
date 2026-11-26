import { describe, expect, it } from "vitest";
import { n09Messages as m } from "./messages.hr";
import { keyAction, followingStep, parseSpeed, playable, precedingStep, sourceTag, stepDelay } from "./model";

describe("N-09 model", () => {
  it("plays at 900 / speed ms and accepts only 1×, 2×, 4×", () => {
    expect([1, 2, 4].map((s) => stepDelay(s as 1 | 2 | 4))).toEqual([900, 450, 225]);
    expect(parseSpeed("4")).toBe(4);
    expect(parseSpeed("3")).toBe(1);
  });
  it("names sources as the prototype does", () => {
    expect(sourceTag("editor")).toEqual({ text: "utipkano", typed: true });
    expect(sourceTag("paste")).toEqual({ text: "zalijepljeno", typed: false });
    expect(sourceTag("unattributed").typed).toBe(false);
  });
  it("steps over changes from 1 and stops at both ends", () => {
    const steps = playable([0, 1, 2, 5]);
    expect(steps).toEqual([1, 2, 5]);
    expect(followingStep(steps, 2)).toBe(5);
    expect(followingStep(steps, 5)).toBeNull();
    expect(precedingStep(steps, 1)).toBeNull();
    expect(precedingStep(steps, 5)).toBe(2);
  });
  it("keeps the prototype wording", () => {
    expect(m.intro).toBe("Ovo je nastanak rada, promjenu po promjenu. Služi razgovoru o radu, ne ocjeni. Bez vremenske osi i bez trajanja.");
    expect(m.foot).toContain("Reprodukciju smijete gledati i prije predaje; student to zna iz obavijesti o zadatku.");
    expect([m.play, m.stop, m.previous, m.next]).toEqual(["Pokreni", "Zaustavi", "Prethodna promjena", "Sljedeća promjena"]);
    expect(m.sliderValue(3, 12)).toBe("Promjena 3 od 12");
    expect(m.empty).toBe("Nema promjena za prikaz: rad još nije započet.");
    expect(m.error).toBe("Promjene rada trenutačno nije moguće učitati. Pokušajte ponovno.");
  });
  it("maps shortcuts and leaves keys to fields, buttons and modified chords", () => {
    const div = { tagName: "DIV" };
    expect(keyAction(" ", div)).toBe("toggle");
    expect(keyAction("ArrowLeft", div)).toBe("previous");
    expect(keyAction("ArrowRight", div)).toBe("next");
    expect(keyAction("Home", div)).toBe("first");
    expect(keyAction("End", div)).toBe("last");
    expect(keyAction("a", div)).toBeNull();
    expect(keyAction(" ", { tagName: "BUTTON" })).toBeNull();
    expect(keyAction("ArrowRight", { tagName: "BUTTON" })).toBe("next");
    expect(keyAction("ArrowRight", { tagName: "INPUT" })).toBeNull();
    expect(keyAction("ArrowRight", { tagName: "SELECT" })).toBeNull();
    expect(keyAction("ArrowRight", div, { ctrl: true })).toBeNull();
  });
});
