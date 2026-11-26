/**
 * ED-44 (P2-16): the parts of the prototype's "Prikaz" (menu-view) the sheet
 * switch does not cover. "Ljuska" is the app's own light or dark (`data-theme`
 * on `<html>`, kept in this browser by the design v3 theme), so on /rad, which
 * has no side shell and no switch of its own, Prikaz is where it changes.
 * The prototype's "Prikaz" group the host cannot show yet is listed, disabled,
 * never hidden (Val 6).
 */
import { readTheme, saveTheme, type ShellTheme } from "@ductura/ui";

import { toolbarBehaviourHr as hr } from "./messages.hr";

type Item = { id: string; label: string; disabled?: boolean; hint?: string };

/** The prototype's Prikaz group: Sadržaj na listu, Promjene od predaje mentoru, Povijest rada, Prvi redovi. */
export const PENDING_VIEWS = ["viewToc", "viewDiff", "viewHistory", "viewFirstLines"] as const;
// "Struktura rada" (DraftPanelHost) and "Čisti tekst" are no longer pending: see viewItems.

const mark = (on: boolean, label: string) => `${on ? "✓ " : ""}${label}`;

/** "Tamna ljuska" and "Svijetla ljuska", the kept one ticked. */
export function shellItems(shell: ShellTheme): Item[] {
  return [
    { id: "shell:dark", label: mark(shell === "dark", hr.viewShellDark) },
    { id: "shell:light", label: mark(shell === "light", hr.viewShellLight) },
  ];
}

/** "Čisti tekst" (prototype t2Clean): hides the quiet hints in the text. Kept in this browser; the page carries it as `data-clean-text` on <html>. */
export const CLEAN_KEY = "ductura.editor.cleanText";
export const CLEAN_ATTR = "data-clean-text";

export function viewItems(clean: boolean): Item[] {
  return [
    { id: "structure", label: hr.viewStructure },
    { id: "cleanText", label: mark(clean, hr.viewCleanText) },
  ];
}

export function readClean(root: Pick<HTMLElement, "getAttribute"> | null, storage: () => Pick<Storage, "getItem"> | undefined): boolean {
  const on = root?.getAttribute(CLEAN_ATTR);
  if (on === "on") return true;
  if (on === "off") return false;
  try {
    return storage()?.getItem(CLEAN_KEY) === "on";
  } catch {
    return false;
  }
}

/** Puts "Čisti tekst" on <html> and keeps it; blocked storage keeps it for this page only. */
export function setClean(root: Pick<HTMLElement, "setAttribute">, storage: () => Pick<Storage, "setItem"> | undefined, next: boolean): boolean {
  root.setAttribute(CLEAN_ATTR, next ? "on" : "off");
  try {
    storage()?.setItem(CLEAN_KEY, next ? "on" : "off");
  } catch {
    // Storage blocked: the setting still holds on this page.
  }
  return next;
}

export function pendingViewItems(): Item[] {
  return PENDING_VIEWS.map((id) => ({ id, label: hr[id], disabled: true, hint: hr.menuUnavailable }));
}

/** The shell's theme on this page: what `<html>` carries, else what the browser keeps. */
export function currentShell(root: Pick<HTMLElement, "getAttribute"> | null, storage: () => Pick<Storage, "getItem"> | undefined): ShellTheme {
  const on = root?.getAttribute("data-theme");
  if (on === "light" || on === "dark") return on;
  try {
    return readTheme(storage());
  } catch {
    return "dark";
  }
}

/** Puts the shell's theme on `<html>` and keeps it; blocked storage keeps it for this page only. */
export function setShell(root: Pick<HTMLElement, "setAttribute">, storage: () => Pick<Storage, "setItem"> | undefined, next: ShellTheme): ShellTheme {
  root.setAttribute("data-theme", next);
  let kept: Pick<Storage, "setItem"> | undefined;
  try {
    kept = storage();
  } catch {
    // Storage blocked: the theme still changes on this page.
  }
  saveTheme(kept, next);
  return next;
}
