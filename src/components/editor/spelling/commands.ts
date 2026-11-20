/**
 * What the "Prikaz ▾ → Pisanje" items do (WEB-1104). Each returns the toast
 * text, so the page shows it and the logic is testable without a DOM.
 */
import type { Editor } from "@tiptap/core";

import type { SpellingController } from "./controller";
import { editorSpellingHr as t } from "./messages.hr";
import { hitsOf, nextHit, selectHit } from "./plugin";

const fill = (s: string, v: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k: string) => String(v[k] ?? ""));

export function toggleSpelling(c: SpellingController): string {
  const was = c.status;
  c.toggle();
  if (c.status === "off") return t.toastOff;
  return was === "on" ? t.toastOn : c.status === "loading" ? t.toastLoading : t.toastOn;
}

/** Moves the selection to the next marked word and says which one it is. */
export function goToNext(editor: Editor, c: SpellingController): string {
  if (!c.isOn) return t.toastNotOn;
  const next = nextHit(editor.state);
  if (!next) return t.toastNone;
  editor.view.dispatch(selectHit(editor.state, next.hit));
  editor.view.focus();
  return fill(t.toastPosition, { i: next.index + 1, n: next.total, word: next.hit.word });
}

export type MenuState = { label: string; note: string; checked: boolean; next: { label: string } | null };

/** The two menu entries: the switch with its state, and "next" when there is something to see. */
export function menuState(c: SpellingController, editor: Editor | null): MenuState {
  const count = editor ? hitsOf(editor.state).length : 0;
  const note = c.status === "off" ? t.menuOff
    : c.status === "loading" ? t.menuLoading
    : c.status === "fail" ? t.menuUnavailable
    : count ? fill(t.menuCount, { n: count }) : t.menuClean;
  return { label: t.menuLabel, note, checked: c.status === "on" || c.status === "loading", next: count ? { label: t.next } : null };
}
