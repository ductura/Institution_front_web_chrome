// PIL-D8-PRECACI (P-D8): every shortcut the editor commands answer has its description in
// shortcut-definitions.ts with the same keys, so a new shortcut without a description fails here.
import { describe, expect, it } from "vitest";

import { editorShortcut, shortcutGroups } from "../../../../../../src/components/editor/commands/shortcuts";
import { displayKeys, SHORTCUTS } from "./shortcut-definitions";

type Probe = (event: KeyboardEvent) => string | null;
type Chord = { ctrlKey: boolean; metaKey: boolean; altKey: boolean; shiftKey: boolean; key: string };

const KEYS = [
  ...Array.from({ length: 95 }, (_, i) => String.fromCharCode(32 + i)),
  ...Array.from({ length: 12 }, (_, i) => `F${i + 1}`),
  "Escape", "Enter", "Tab", "Backspace", "Delete", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Home", "End",
];
const MODIFIERS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15].map((bits) => ({
  ctrlKey: (bits & 1) > 0, metaKey: (bits & 2) > 0, altKey: (bits & 4) > 0, shiftKey: (bits & 8) > 0,
}));

/** "Ctrl+K", "Cmd+K", "Alt+F10": how the list writes the chord. */
function chordText({ ctrlKey, metaKey, altKey, shiftKey, key }: Chord): string {
  const named: Record<string, string> = { Escape: "Esc", ArrowUp: "↑", ArrowDown: "↓" };
  return [ctrlKey && "Ctrl", metaKey && "Cmd", altKey && "Alt", shiftKey && "Shift", named[key] ?? (key.length === 1 ? key.toUpperCase() : key)]
    .filter(Boolean).join("+");
}

/** The chords a probe answers that have no description, or a description with other keys. */
function undescribed(probe: Probe): string[] {
  const missing = new Set<string>();
  for (const key of KEYS) {
    for (const modifiers of MODIFIERS) {
      if (modifiers.ctrlKey && modifiers.metaKey) continue;
      const chord = { ...modifiers, key };
      const id = probe({ ...chord, isComposing: false, repeat: false, defaultPrevented: false } as KeyboardEvent);
      if (id === null) continue;
      const def = SHORTCUTS.find((candidate) => candidate.id === id);
      const written = def ? displayKeys(def, chord.metaKey).split(" ili ") : [];
      if (!written.includes(chordText(chord))) missing.add(`${id}: ${chordText(chord)}`);
    }
  }
  return [...missing].sort();
}

describe("shortcut-definitions.ts matches the editor commands (PIL-D8-PRECACI)", () => {
  it("describes every chord the editor commands answer, with the same keys on PC and Mac", () => {
    expect(undescribed(editorShortcut)).toEqual([]);
  });
  it("fails for a new shortcut that has no description", () => {
    const withNew: Probe = (event) => (event.ctrlKey && !event.altKey && !event.shiftKey && event.key === "j" ? "justify" : editorShortcut(event));
    expect(undescribed(withNew)).toEqual(["justify: Ctrl+J"]);
  });
  it("fails for a described shortcut whose keys changed", () => {
    const moved: Probe = (event) => (event.ctrlKey && !event.altKey && !event.shiftKey && event.key === "p" ? "palette" : null);
    expect(undescribed(moved)).toEqual(["palette: Ctrl+P"]);
  });
  it("describes every key the editor's own list shows", () => {
    const written = new Set(SHORTCUTS.flatMap((def) => displayKeys(def).split(" ili ")));
    const shown = shortcutGroups(true).flatMap(({ items }) => items.map((item) => item.keys));
    expect(shown.length).toBeGreaterThan(0);
    expect(shown.filter((keys) => !written.has(keys))).toEqual([]);
  });
});
