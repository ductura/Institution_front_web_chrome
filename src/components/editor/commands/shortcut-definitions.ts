// WEB-1908 (P-D8), ED-03 (NF2-P5, P2-2): the one definition of the editor's keyboard shortcuts.
// The one list (Ctrl+/, "?" and the "Prečaci" button), the toolbar's aria-keyshortcuts and the
// palette hints all read it, so a command's shortcut cannot differ between them. A row is here only
// while the editor answers it (e2e shortcut-list.spec.ts presses every row). ED-33 (P2-2) wired the
// sentence and chapter moves and ED-112 the outline key; the comment key (Ctrl+Alt+M) comes back when the
// student editor has that action. Command ids match WEB-6D.
import type { ShortcutListGroup } from "@ductura/ui";

export type ShortcutDefinition = {
  id: string;
  group: "writing" | "moving" | "view";
  label: string;
  /** Display keys on Windows/Linux; "Mod" stands for Ctrl (Cmd on a Mac). */
  keys: string;
  /** Macintosh display keys when they differ from `keys` with Mod = Cmd. */
  macKeys?: string;
  /** Needs a work that can be written in; hidden for a locked (read-only) work. */
  writes?: boolean;
};

export const SHORTCUT_GROUP_TITLES = { writing: "Pisanje", moving: "Kretanje i uređivanje", view: "Prikaz" } as const;

export const SHORTCUTS: readonly ShortcutDefinition[] = [
  { id: "undo", group: "writing", label: "Poništi", keys: "Mod+Z", writes: true },
  { id: "redo", group: "writing", label: "Ponovi", keys: "Ctrl+Y", macKeys: "Cmd+Shift+Z", writes: true },
  { id: "bold", group: "writing", label: "Podebljano", keys: "Mod+B", writes: true },
  { id: "italic", group: "writing", label: "Kurziv", keys: "Mod+I", writes: true },
  { id: "paragraph", group: "writing", label: "Odlomak", keys: "Mod+Alt+0", writes: true },
  { id: "heading1", group: "writing", label: "Naslov 1", keys: "Mod+Alt+1", writes: true },
  { id: "heading2", group: "writing", label: "Naslov 2", keys: "Mod+Alt+2", writes: true },
  { id: "heading3", group: "writing", label: "Naslov 3", keys: "Mod+Alt+3", writes: true },
  // Numerirani popis (Mod+Shift+7) waits for the v4 document: the student editor mounts no numbered item yet.
  { id: "palette", group: "moving", label: "Naredbe: sve na jednom mjestu", keys: "Mod+K" },
  { id: "find", group: "moving", label: "Traži i zamijeni", keys: "Mod+F" },
  { id: "toolbar", group: "moving", label: "Na alatnu traku", keys: "Alt+F10" },
  { id: "moveSentence", group: "moving", label: "Rečenica gore ili dolje u odlomku", keys: "Alt+↑ ili Alt+↓", writes: true },
  { id: "moveChapter", group: "moving", label: "Poglavlje gore ili dolje", keys: "Alt+Shift+↑ ili Alt+Shift+↓", writes: true },
  { id: "focus", group: "view", label: "Način fokusa", keys: "Mod+." },
  // ED-112: the structure rail answers Ctrl+\ (EditorPanelLayout, structure-rail.ts).
  { id: "outline", group: "view", label: "Struktura rada", keys: "Mod+\\" },
  { id: "shortcuts", group: "view", label: "Ovaj popis", keys: "Mod+/ ili ?" },
  { id: "close", group: "view", label: "Zatvara prozor ili izbornik", keys: "Esc" },
];

export function displayKeys(def: ShortcutDefinition, mac = false): string {
  return mac ? def.macKeys ?? def.keys.replace("Mod", "Cmd") : def.keys.replace("Mod", "Ctrl");
}

/** The groups for the list; a locked work omits the writing shortcuts. */
export function shortcutListGroups(editable: boolean, mac = false): ShortcutListGroup[] {
  return (Object.keys(SHORTCUT_GROUP_TITLES) as (keyof typeof SHORTCUT_GROUP_TITLES)[])
    .map((group) => ({
      id: group,
      title: SHORTCUT_GROUP_TITLES[group],
      items: SHORTCUTS.filter((def) => def.group === group && (editable || !def.writes))
        .map((def) => ({ id: def.id, label: def.label, keys: displayKeys(def, mac) })),
    }))
    .filter(({ items }) => items.length > 0);
}

/** The value for aria-keyshortcuts of a command ("Control+Z"); undefined when it has none. */
export function ariaKeyShortcuts(id: string, mac = false): string | undefined {
  const def = SHORTCUTS.find((candidate) => candidate.id === id);
  if (!def) return undefined;
  return displayKeys(def, mac).split(" ili ")[0]!.replace("Ctrl", "Control").replace("Cmd", "Meta");
}

/** The list in the shape of the editor's own dialog (title and rows). */
export function shortcutDialogGroups(editable: boolean, mac = false) {
  return shortcutListGroups(editable, mac).map(({ title, items }) => ({ title, items: items.map(({ label, keys }) => ({ label, keys })) }));
}

/**
 * The event that asks the page's one shortcut list to open or close. The host that draws the
 * list takes it (preventDefault); when no host does, the editor commands draw the same list.
 */
export const SHORTCUT_LIST_EVENT = "ductura:shortcut-list";

/** Asks the page's shortcut list to toggle; false when no host took it. */
export function requestShortcutList(target: EventTarget = document): boolean {
  return !target.dispatchEvent(new Event(SHORTCUT_LIST_EVENT, { cancelable: true }));
}