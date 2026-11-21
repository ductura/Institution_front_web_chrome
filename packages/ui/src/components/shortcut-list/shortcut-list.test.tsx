import { renderToStaticMarkup as html } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ShortcutList, ShortcutListDialog } from "./ShortcutList";
import { opensShortcutList, spokenKeys, visibleGroups } from "./shortcut-list-model";

const groups = [
  { id: "write", title: "Pisanje", items: [{ id: "undo", label: "Poništi", keys: "Ctrl+Z" }] },
  { id: "empty", title: "Prazno", items: [] },
];
const press = (event: object) => opensShortcutList({ key: "", ctrlKey: false, metaKey: false, altKey: false, isComposing: false, defaultPrevented: false, target: null, ...event });

describe("shortcut list model", () => {
  it("speaks chords in words", () => {
    expect(spokenKeys("Ctrl+Z")).toBe("Control plus Z");
    expect(spokenKeys("Alt+↑ ili ↓")).toBe("Alt plus strelica gore ili strelica dolje");
    expect(spokenKeys("Esc")).toBe("Escape");
  });
  it("drops empty groups", () => {
    expect(visibleGroups(groups).map((g) => g.id)).toEqual(["write"]);
  });
  it("opens with Ctrl or Cmd plus slash, and with ? outside text fields only", () => {
    expect(press({ key: "/", ctrlKey: true })).toBe(true);
    expect(press({ key: "/", metaKey: true })).toBe(true);
    expect(press({ key: "?" })).toBe(true);
    expect(press({ key: "?", target: { tagName: "TEXTAREA" } })).toBe(false);
    expect(press({ key: "?", target: { tagName: "DIV", isContentEditable: true } })).toBe(false);
    expect(press({ key: "?", isComposing: true })).toBe(false);
    expect(press({ key: "?", defaultPrevented: true })).toBe(false);
    expect(press({ key: "/" })).toBe(false);
  });
});

describe("shortcut list rendering", () => {
  it("renders headed groups with a spoken form and hides the visible keys from readers", () => {
    const m = html(<ShortcutList groups={groups} />);
    expect(m).toContain("<h3");
    expect(m).toContain("Pisanje");
    expect(m).not.toContain("Prazno");
    expect(m).toContain('<kbd class="');
    expect(m).toContain('aria-hidden="true">Ctrl+Z</kbd>');
    expect(m).toContain("Control plus Z");
  });
  it("says so when there is nothing to show", () => {
    expect(html(<ShortcutList groups={[]} />)).toContain("Nema prečaca");
  });
  it("is a dialog with a close button, and nothing while closed", () => {
    const open = html(<ShortcutListDialog open groups={groups} onClose={() => undefined} />);
    expect(open).toContain("Prečaci");
    expect(open).toContain("Zatvori");
    expect(html(<ShortcutListDialog open={false} groups={groups} onClose={() => undefined} />)).toBe("");
  });
});
