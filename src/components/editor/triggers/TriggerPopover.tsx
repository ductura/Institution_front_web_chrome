"use client";

import { Popover } from "@ductura/ui";
import type { Editor } from "@tiptap/core";
import { useEffect, useEffectEvent, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { moveItem, triggerAt, triggerItems, type Actions, type Item, type Source, type Trigger } from "./items";
import { editorTriggersHr as t } from "./messages.hr";
import styles from "./TriggerPopover.module.css";

type Menu = { trigger: Trigger; items: readonly Item[]; active: number };
type Props = { editor: Editor | null; sources?: readonly Source[]; actions?: Actions };
const emptySources: readonly Source[] = [];
const noActions: Actions = {};

function triggerIn(editor: Editor, citeAt: number | null): Trigger | null {
  if (editor.isDestroyed || !editor.isEditable || !editor.isFocused || editor.view.composing) return null;
  const { empty, from, $from } = editor.state.selection;
  if (!empty || !$from.parent.isTextblock) return null;
  return from === citeAt ? { mode: "cite", query: "", from, to: from }
    : triggerAt($from.parent.textBetween(0, $from.parentOffset, "", "\uFFFC"), from);
}

export function TriggerPopover({ editor, sources = emptySources, actions = noActions }: Props) {
  const [menu, setMenu] = useState<Menu | null>(null);
  const [host, setHost] = useState<HTMLElement | null>(null);
  const latest = useRef<Menu | null>(null);
  const dismissed = useRef<number | null>(null);
  const citeAt = useRef<number | null>(null);
  const anchor = useRef<HTMLSpanElement>(null);
  const listId = useId();
  const update = (next: Menu | null) => { latest.current = next; setMenu(next); };
  const dismiss = () => {
    dismissed.current = latest.current?.trigger.from ?? null;
    citeAt.current = null;
    update(null);
  };
  const placeAnchor = () => {
    if (!editor || editor.isDestroyed || !anchor.current || !latest.current) return;
    const caret = editor.view.coordsAtPos(latest.current.trigger.to);
    Object.assign(anchor.current.style, {
      left: `${caret.left}px`, insetBlockStart: `${caret.top}px`, height: `${caret.bottom - caret.top}px`,
    });
  };

  const refresh = () => {
    if (!editor) { update(null); return; }
    const trigger = triggerIn(editor, citeAt.current);
    if (!trigger) {
      if (!editor.isDestroyed && editor.isFocused && !editor.view.composing) dismissed.current = null;
      citeAt.current = null;
    }
    if (!trigger || trigger.from === dismissed.current) { update(null); return; }
    if (trigger.mode !== "cite") citeAt.current = null;
    const items = triggerItems(trigger, sources, actions, () => { citeAt.current = editor.state.selection.from; });
    const previous = latest.current;
    const stillSelected = previous?.trigger.mode === trigger.mode && previous.trigger.from === trigger.from
      && previous.trigger.query === trigger.query ? previous.items[previous.active]?.id : undefined;
    const active = items.findIndex((item) => item.id === stillSelected && !item.disabled);
    update({ trigger, items, active: active < 0 ? moveItem(items, -1, 1) : active });
    placeAnchor();
  };

  const pick = (item: Item | undefined) => {
    const trigger = latest.current?.trigger;
    if (!editor || !item || item.disabled || !trigger) return;
    const current = triggerIn(editor, citeAt.current);
    if (!current || current.from !== trigger.from || current.to !== trigger.to || current.query !== trigger.query || current.mode !== trigger.mode) return;
    const { from, to } = trigger;
    if (item.transform && !item.transform(editor.can().chain().deleteRange({ from, to })).run()) return;
    citeAt.current = null;
    update(null);
    const chain = editor.chain().focus();
    if (from !== to) chain.deleteRange({ from, to });
    if (item.transform) item.transform(chain).run();
    else if (chain.run()) {
      item.run?.();
      if (citeAt.current !== null) refresh();
    }
  };

  const onKey = useEffectEvent((event: KeyboardEvent) => {
    const current = latest.current;
    if (!current || !editor?.isEditable || event.defaultPrevented || event.isComposing || editor.view.composing) return;
    const { key } = event;
    if (current.active < 0 || !["ArrowDown", "ArrowUp", "Enter", "Tab"].includes(key)) return;
    event.preventDefault();
    event.stopPropagation();
    if (key === "Enter" || key === "Tab") pick(current.items[current.active]);
    else update({ ...current, active: moveItem(current.items, current.active, key === "ArrowDown" ? 1 : -1) });
  });
  const onRefresh = useEffectEvent(refresh);
  const onGeometry = useEffectEvent(placeAnchor);

  useEffect(() => { setHost(document.body); }, []);
  useEffect(() => {
    if (!editor) return;
    const element = editor.view.dom;
    let frame = 0;
    const onCompositionStart = () => { update(null); };
    const onCompositionEnd = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(onRefresh); };
    const onTransaction = () => { onRefresh(); };
    editor.on("transaction", onTransaction).on("focus", onTransaction).on("blur", onTransaction);
    editor.on("update", onTransaction);
    element.addEventListener("keydown", onKey, true);
    element.addEventListener("compositionstart", onCompositionStart);
    element.addEventListener("compositionend", onCompositionEnd);
    window.addEventListener("scroll", onGeometry, true);
    window.addEventListener("resize", onGeometry);
    return () => {
      cancelAnimationFrame(frame);
      editor.off("transaction", onTransaction).off("focus", onTransaction).off("blur", onTransaction);
      editor.off("update", onTransaction);
      element.removeEventListener("keydown", onKey, true);
      element.removeEventListener("compositionstart", onCompositionStart);
      element.removeEventListener("compositionend", onCompositionEnd);
      window.removeEventListener("scroll", onGeometry, true);
      window.removeEventListener("resize", onGeometry);
      latest.current = null;
      dismissed.current = null;
      citeAt.current = null;
    };
  }, [editor]);

  useEffect(() => { onRefresh(); }, [editor, sources, actions]);
  // Popover measures again when the caret or the list's height may have changed.
  const changingAnchor = useMemo(() => ({ get current() { return anchor.current; } }), [menu?.trigger.to, menu?.trigger.mode, menu?.trigger.query, menu?.items.length]);
  const active = menu?.items[menu.active];
  const activeId = active ? `${listId}-${active.id}` : undefined;
  const hasOptions = Boolean(menu?.items.length);
  useLayoutEffect(() => {
    if (!editor || !hasOptions) return;
    const element = editor.view.dom;
    element.setAttribute("aria-controls", listId);
    element.setAttribute("aria-autocomplete", "list");
    if (activeId) {
      element.setAttribute("aria-activedescendant", activeId);
      document.getElementById(activeId)?.scrollIntoView({ block: "nearest" });
    }
    return () => {
      element.removeAttribute("aria-controls");
      element.removeAttribute("aria-autocomplete");
      element.removeAttribute("aria-activedescendant");
    };
  }, [editor, hasOptions, listId, activeId]);

  const label = menu?.trigger.mode === "at" ? t.sources : menu?.trigger.mode === "cite" ? t.citation : t.commands;
  // It follows the shell theme even when the paper has its own theme.
  return host && createPortal(<>
    <span ref={anchor} className={styles.anchor} aria-hidden="true" />
    <Popover open={menu !== null} anchor={changingAnchor} label={label} onClose={dismiss}>
      <div className={styles.heading} aria-hidden="true">{label}</div>
      {hasOptions ? <div id={listId} role="listbox" aria-label={label}>
        {menu?.items.map((item) => <div key={item.id} id={`${listId}-${item.id}`} role="option" className={styles.item}
          aria-selected={item === active} aria-disabled={item.disabled || undefined}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => pick(item)}>
          <span>{item.label}</span><small>{item.hint}</small>
        </div>)}
      </div> : <p className={styles.empty} role="status">{menu?.trigger.mode === "slash" ? t.empty : t.noSources}</p>}
    </Popover>
  </>, host);
}
