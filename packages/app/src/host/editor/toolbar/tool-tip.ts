// WEB-2131: the tool tip of a toolbar button (#tbTip in the prototype): name, shortcut and one sentence.
// Timing as in the prototype: a mouse shows it after 380 ms (60 ms when one is already open) and hides it after
// 80 ms; the keyboard shows it on focus; a held touch shows it after 450 ms and hides it 1.8 s after release.
import { toolbarBehaviourHr as t } from "./messages.hr";

export const TIP_DELAY_MS = 380;
export const TIP_DELAY_WARM_MS = 60;
export const TIP_HIDE_MS = 80;
export const TIP_HOLD_MS = 450;
export const TIP_TOUCH_HIDE_MS = 1800;
/** The gap to the button and to the edge of the screen. */
export const TIP_GAP_PX = 8;

/** One sentence for each tool of the toolbar, by its id. */
export const TOOL_DESCRIPTIONS: Readonly<Record<string, string>> = {
  undo: "Vraća zadnju promjenu u tekstu.",
  redo: "Ponovno primjenjuje poništenu promjenu.",
  paragraph: "Obični odlomak teksta.",
  heading1: "Naslov rada.",
  heading2: "Naslov poglavlja.",
  heading3: "Naslov potpoglavlja.",
  bold: "Podebljava označeni tekst.",
  italic: "Ukošuje označeni tekst.",
  bulletList: "Pretvara odlomak u popis s točkama.",
  numberedList: "Pretvara odlomak u numerirani popis.",
  quote: "Označeni odlomak postaje blok-citat.",
  cite: "Umetnite navod iz svojih izvora (ili upišite @).",
  comment: "Komentar ili pitanje uz označeni tekst (Ctrl+Alt+M ili desni klik).",
  hole: "Za provjeru: nastavite pisati, vratite se poslije.",
  find: "Traži i zamijeni tekst u radu.",
  view: "Pomoć u tekstu, izgled lista, veličina teksta.",
  export: "Word, pregled ispisa i kopija teksta rada.",
  focus: "Mirni način: samo list i tekst.",
  commands: "Sve naredbe na jednom mjestu.",
  more: t.moreDescription,
  blockStyle: t.blockStyleDescription,
};

export type ToolTip = { name: string; shortcut: string | null; description: string | null };

/** What the tip of a button says; null for a button with no name. `shortcut` is the display form ("Ctrl+B"). */
export function toolTip(id: string, name: string, shortcut?: string | null): ToolTip | null {
  const label = name.trim();
  if (label === "") return null;
  return { name: label, shortcut: shortcut?.trim() || null, description: TOOL_DESCRIPTIONS[id] ?? null };
}

/** The "Control+B" of aria-keyshortcuts in the form people read: "Ctrl+B". */
export function displayShortcut(aria: string | undefined): string | null {
  if (!aria) return null;
  return aria.replace("Control", "Ctrl").replace("Meta", "Cmd");
}

export type TipPlace = { left: number; top: number };

/** Centred below the button, 8 px away, and kept 8 px inside the screen. */
export function tipPlace(button: { left: number; width: number; bottom: number }, tip: { width: number }, viewport: { width: number }): TipPlace {
  const centred = button.left + button.width / 2 - tip.width / 2;
  const left = Math.max(TIP_GAP_PX, Math.min(centred, viewport.width - tip.width - TIP_GAP_PX));
  return { left, top: button.bottom + TIP_GAP_PX };
}

/** How long to wait before showing for this kind of input. */
export function showDelay(input: "mouse" | "keyboard" | "touch", warm: boolean): number {
  if (input === "keyboard") return 0;
  if (input === "touch") return TIP_HOLD_MS;
  return warm ? TIP_DELAY_WARM_MS : TIP_DELAY_MS;
}
