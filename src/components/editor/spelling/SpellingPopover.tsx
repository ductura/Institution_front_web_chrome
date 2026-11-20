"use client";

import { Popover } from "@ductura/ui";
import type { Editor } from "@tiptap/core";
import { useEffect, useRef, useState } from "react";

import type { SpellingController } from "./controller";
import { editorSpellingHr as t } from "./messages.hr";
import { hitAt, replaceHit, type SpellHit } from "./plugin";
import styles from "./SpellingPopover.module.css";

type Props = { editor: Editor | null; controller: SpellingController; onMessage?: (text: string) => void };
type Open = { hit: SpellHit; suggestions: string[]; rect: DOMRect };

/** Click on an underlined word: suggestions, "Dodaj u moj rječnik" and "Zanemari u ovom radu". */
export function SpellingPopover({ editor, controller, onMessage }: Props) {
  const [open, setOpen] = useState<Open | null>(null);
  const anchor = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!editor) return;
    const dom = editor.view.dom;
    const onClick = (event: MouseEvent) => {
      const el = (event.target as HTMLElement | null)?.closest<HTMLElement>("[data-spell]");
      if (!el || !controller.speller) { setOpen(null); return; }
      const hit = hitAt(editor.state, editor.view.posAtDOM(el, 0));
      if (!hit) { setOpen(null); return; }
      let suggestions: string[] = [];
      try { suggestions = controller.speller.suggest(hit.word).slice(0, 5); } catch { /* no suggestions */ }
      setOpen({ hit, suggestions, rect: el.getBoundingClientRect() });
    };
    dom.addEventListener("click", onClick);
    return () => dom.removeEventListener("click", onClick);
  }, [editor, controller]);

  useEffect(() => {
    const a = anchor.current;
    if (!a || !open) return;
    Object.assign(a.style, { top: `${open.rect.top}px`, left: `${open.rect.left}px`, width: `${open.rect.width}px`, height: `${open.rect.height}px` });
  }, [open]);

  const close = () => { setOpen(null); editor?.view.focus(); };
  const run = (fn: () => void) => { if (open) { fn(); } close(); };
  return <>
    <span ref={anchor} className={styles.anchor} aria-hidden="true" />
    <Popover open={open !== null} anchor={anchor} label={t.popoverTitle} onClose={close}>
      {open && <div className={styles.body}>
        <p className={styles.unknown}>{t.unknown.replace("{word}", open.hit.word)}</p>
        {open.suggestions.length ? <>
          <div className={styles.heading}>{t.replaceWith}</div>
          {open.suggestions.map((s) => <button key={s} type="button" className={styles.item}
            onClick={() => run(() => { if (editor) editor.view.dispatch(replaceHit(editor.state, open.hit, s)); })}>{s}</button>)}
        </> : <p className={styles.none}>{t.noSuggestions}</p>}
        <button type="button" className={styles.item} onClick={() => run(() => { controller.addToMine(open.hit.word); onMessage?.(t.toastAdded); })}>
          {t.addToMine}<small>{t.addToMineHint}</small></button>
        <button type="button" className={styles.item} onClick={() => run(() => { controller.ignoreInWork(open.hit.word); onMessage?.(t.toastIgnored); })}>
          {t.ignoreInWork}<small>{t.ignoreInWorkHint}</small></button>
      </div>}
    </Popover>
  </>;
}
