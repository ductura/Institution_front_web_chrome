import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { FindBar } from "./FindBar";
import { findKeyAction, findStatus, stepHit } from "./find-logic";

const labels = {
  search: "Traži…", next: "Sljedeći pogodak", previous: "Prethodni pogodak", close: "Zatvori traženje",
  none: "Nema pojava.", count: (n: number, total: number) => `${n} od ${total}`,
};
const noop = () => undefined;
const render = (query: string, current: number, total: number) =>
  renderToStaticMarkup(<FindBar query={query} onQueryChange={noop} current={current} total={total} onNext={noop} onPrevious={noop} onClose={noop} labels={labels} />);

describe("find bar rules (UI-6C)", () => {
  it("maps Enter, Shift+Enter and Escape, and nothing else", () => {
    expect(findKeyAction("Enter", false)).toBe("next");
    expect(findKeyAction("Enter", true)).toBe("prev");
    expect(findKeyAction("Escape", false)).toBe("close");
    expect(findKeyAction("a", false)).toBeNull();
  });

  it("wraps round at both ends and has no index without hits", () => {
    expect(stepHit(2, 3, 1)).toBe(0);
    expect(stepHit(0, 3, -1)).toBe(2);
    expect(stepHit(0, 3, 1)).toBe(1);
    expect(stepHit(0, 0, 1)).toBe(-1);
  });

  it("says nothing for an empty query, 'none' without hits, 'n of N' otherwise", () => {
    expect(findStatus("", 0, 5)).toEqual({ kind: "idle" });
    expect(findStatus("rad", 0, 0)).toEqual({ kind: "none" });
    expect(findStatus("rad", 1, 4)).toEqual({ kind: "hit", position: 2, total: 4 });
    expect(findStatus("rad", 9, 4)).toEqual({ kind: "hit", position: 4, total: 4 });
  });
});

describe("FindBar markup", () => {
  it("is a named search landmark with a labelled field and live count", () => {
    const html = render("rad", 1, 4);
    expect(html).toContain('role="search"');
    expect(html).toContain('aria-label="Traži…"');
    expect(html).toMatch(/role="status" aria-live="polite">2 od 4</);
  });

  it("shows 'none' and disables next and previous without hits", () => {
    const html = render("zzz", -1, 0);
    expect(html).toContain("Nema pojava.");
    expect(html.match(/disabled=""/g)).toHaveLength(2);
  });

  it("shows no count for an empty query", () => {
    expect(render("", 0, 0)).toMatch(/aria-live="polite"><\/span>/);
  });
});
