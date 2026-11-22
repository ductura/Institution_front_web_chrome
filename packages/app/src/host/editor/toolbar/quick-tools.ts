// WEB-2131: the "Brzi alati" bar above the keyboard on a phone (#mbar) and the "Više" menu of it (menu-mb).
// It is shown only at 640 px or less, while the editor can be written in and has the focus, with no dialog or
// palette open. `bottom` is the height of the keyboard from the visual viewport.
import { toolbarBehaviourHr as t } from "./messages.hr";

export const QUICK_MAX_WIDTH = 640;

export type QuickTool = { id: "undo" | "cite" | "comment" | "hole" | "more"; label: string };

export const QUICK_TOOLS: readonly QuickTool[] = [
  { id: "undo", label: t.quickUndo },
  { id: "cite", label: t.quickCite },
  { id: "comment", label: t.quickComment },
  { id: "hole", label: t.quickHole },
  { id: "more", label: t.quickMore },
];

export type QuickBarContext = { width: number; editable: boolean; focused: boolean; dialogOpen: boolean };

export function quickBarVisible(c: QuickBarContext): boolean {
  return c.width <= QUICK_MAX_WIDTH && c.editable && c.focused && !c.dialogOpen;
}

/** Distance from the bottom of the layout viewport to the top of the keyboard (0 without one). */
export function keyboardInset(layoutHeight: number, visual: { height: number; offsetTop: number } | null): number {
  if (visual === null) return 0;
  return Math.max(0, Math.round(layoutHeight - visual.height - visual.offsetTop));
}

export type MobileMoreItem = { id: string; label: string; submenu: boolean };

/** The phone's "Više": three menus, then Ponovi, Podebljano, Kurziv and the command palette. */
export const MOBILE_MORE: readonly MobileMoreItem[] = [
  { id: "insert", label: t.mobileInsert, submenu: true },
  { id: "edit", label: t.mobileEdit, submenu: true },
  { id: "special", label: t.mobileSpecial, submenu: true },
  { id: "redo", label: t.mobileRedo, submenu: false },
  { id: "bold", label: t.mobileBold, submenu: false },
  { id: "italic", label: t.mobileItalic, submenu: false },
  { id: "commands", label: t.mobileCommands, submenu: false },
];
