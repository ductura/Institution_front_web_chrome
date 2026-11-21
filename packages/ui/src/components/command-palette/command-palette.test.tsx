import { renderToStaticMarkup as html } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { DEFAULT_SHORTCUT_GROUPS, ShortcutsDialog } from "../shortcuts-dialog/ShortcutsDialog";
import { CommandPalette } from "./CommandPalette";
import { fold, matches, moveIndex, pushRecent, sections, visibleCommands, type Command } from "./palette-logic";

const cmds: Command[] = [
  { id: "a", label: "Navod", hint: "umetni iz izvora", group: "Naredbe" },
  { id: "b", label: "Način fokusa", hint: "Ctrl+.", group: "Prikaz" },
  { id: "c", label: "Povijest rada", group: "Prikaz", disabled: true },
  { id: "d", label: "Tablica", group: "Naredbe" },
];

describe("command palette logic", () => {
  it("searches without diacritics and needs every word", () => {
    expect(fold("Način ĐurĐa")).toBe("nacin durda");
    expect(matches(cmds[1]!, "nacin fokus")).toBe(true);
    expect(matches(cmds[1]!, "nacin tablica")).toBe(false);
  });
  it("puts recent first without a query, capped at 10", () => {
    expect(visibleCommands(cmds, "", ["d"]).map((c) => c.id)).toEqual(["d", "a", "b", "c"]);
    const many = Array.from({ length: 20 }, (_, i): Command => ({ id: `${i}`, label: `x${i}`, group: "g" }));
    expect(visibleCommands(many, "", [])).toHaveLength(10);
    expect(visibleCommands(many, "x", [])).toHaveLength(14);
  });
  it("labels recent section and keeps groups in order", () => {
    expect(sections(visibleCommands(cmds, "", ["d"]), "", ["d"]).map((s) => s.title)).toEqual(["Nedavno", "Naredbe", "Prikaz"]);
  });
  it("arrow keys skip disabled items and wrap", () => {
    expect(moveIndex(cmds, 1, 1)).toBe(3);
    expect(moveIndex(cmds, 3, 1)).toBe(0);
    expect(moveIndex(cmds, 0, -1)).toBe(3);
    expect(moveIndex([{ ...cmds[2]! }], 0, 1)).toBe(-1);
  });
  it("recent list has no duplicates and at most 4", () => {
    expect(pushRecent(["a", "b", "c", "d"], "c")).toEqual(["c", "a", "b", "d"]);
    expect(pushRecent(["a", "b", "c", "d"], "e")).toEqual(["e", "a", "b", "c"]);
  });
});

describe("rendering", () => {
  it("palette is closed by default and renders nothing", () => {
    expect(html(<CommandPalette open={false} commands={cmds} onRun={() => undefined} onClose={() => undefined} />)).toBe("");
  });
  it("shortcuts dialog lists groups with kbd and a labelled heading", () => {
    const m = html(<ShortcutsDialog open groups={DEFAULT_SHORTCUT_GROUPS} onClose={() => undefined} />);
    expect(m).toContain("Prečaci");
    expect(m).toContain("Kretanje i uređivanje");
    expect(m).toContain("<kbd");
    expect(m).toContain("Zatvori");
  });
});
