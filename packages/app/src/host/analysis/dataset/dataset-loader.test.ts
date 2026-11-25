import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { DatasetLoader, MAX_SHOWN_ERRORS, stateOfText } from "./DatasetLoader";
import { datasetMessages as t } from "./messages.hr";

// Invented data only.
const GOOD = "Skupina;Mjerenje\nA;1,5\nB;2\n";

describe("stateOfText", () => {
  it("loads a good set", () => {
    const state = stateOfText(GOOD);
    expect(state.kind).toBe("loaded");
  });

  it("turns a bad input into Croatian messages instead of throwing", () => {
    expect(stateOfText("")).toEqual({ kind: "refused", errors: ["Nema podataka: datoteka ili tekst su prazni."], more: 0 });
    const state = stateOfText("a;a\n1;2;3");
    expect(state.kind === "refused" && state.errors[0]).toContain("Naziv stupca “a” već postoji");
  });

  it("shows at most ten errors and counts the rest", () => {
    const rows = Array.from({ length: 30 }, () => "1;2;3").join("\n");
    const state = stateOfText(`a;b\n${rows}`);
    expect(state.kind).toBe("refused");
    if (state.kind === "refused") {
      expect(state.errors).toHaveLength(MAX_SHOWN_ERRORS);
      expect(state.more).toBe(20);
      expect(state.errors[0]).toBe("Redak 1, stupac 3: Broj ćelija ne odgovara broju stupaca.");
    }
  });
});

describe("DatasetLoader", () => {
  it("renders a file field and a text field from the shared components, with nothing sent", () => {
    const html = renderToStaticMarkup(createElement(DatasetLoader, { onLoaded: () => undefined }));
    expect(html).toContain(t.file);
    expect(html).toContain('type="file"');
    expect(html).toContain("<textarea");
    expect(html).toContain(t.load);
    expect(html).not.toContain("<form");
    expect(html).not.toContain('role="alert"');
  });
});
