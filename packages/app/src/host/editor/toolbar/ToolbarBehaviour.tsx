"use client";

// WEB-2131 (par-e-traka): the behaviour around the @ductura/ui toolbar: the tool tip, the look of the buttons,
// "Više" and the customise dialog, the context button, the quick bar on a phone and the text size. The shell hands
// in the editor's state and commands; nothing here reads or writes the document.
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { Button, ContextMenu, Dialog, EditorToolbar, type EditorToolbarGroup, type MenuEntry, type MenuPoint } from "@ductura/ui";

import { contextButton, type ContextAction, type CursorPlace } from "./context-button";
import { toolbarBehaviourHr as t } from "./messages.hr";
import { quickBarVisible, QUICK_TOOLS, QUICK_MAX_WIDTH, keyboardInset, type QuickTool } from "./quick-tools";
import { displayShortcut, showDelay, TIP_HIDE_MS, TIP_TOUCH_HIDE_MS, tipPlace, toolTip, type ToolTip } from "./tool-tip";
import { arrangeToolbar, arrangedIds, customisableIds, moveTool, resetPrefs, setLook, toggleTool, type ToolbarLook, type ToolbarPrefs } from "./toolbar-prefs";
import { canStep, stepZoom, zoomPercent } from "./text-size";
import styles from "./ToolbarBehaviour.module.css";

const MORE_ID = "more";

/** The tool tip: a mouse shows it after a pause, the keyboard on focus, a touch held down. One layer for the whole toolbar. */
function useToolTip(wrap: RefObject<HTMLDivElement | null>, lookup: (label: string) => { id: string; name: string; shortcut?: string } | null) {
  const [tip, setTip] = useState<{ tip: ToolTip; left: number; top: number } | null>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const timers = useRef<{ show?: number; hide?: number }>({});
  const warm = useRef(false);
  const rect = useRef<{ left: number; width: number; bottom: number } | null>(null);

  const clear = () => { window.clearTimeout(timers.current.show); window.clearTimeout(timers.current.hide); };
  const hide = useCallback((after = 0) => {
    window.clearTimeout(timers.current.show);
    window.clearTimeout(timers.current.hide);
    timers.current.hide = window.setTimeout(() => { setTip(null); rect.current = null; warm.current = false; }, after);
  }, []);
  const show = useCallback((button: HTMLElement, input: "mouse" | "keyboard" | "touch") => {
    const label = button.getAttribute("aria-label") ?? "";
    const found = lookup(label);
    const info = found ? toolTip(found.id, found.name, displayShortcut(found.shortcut)) : null;
    if (info === null) return;
    clear();
    timers.current.show = window.setTimeout(() => {
      const box = button.getBoundingClientRect();
      rect.current = { left: box.left, width: box.width, bottom: box.bottom };
      setTip({ tip: info, left: box.left, top: box.bottom + 8 });
      warm.current = true;
    }, showDelay(input, warm.current));
  }, [lookup]);

  // Placed once drawn, so its own width is known.
  useLayoutEffect(() => {
    const el = tipRef.current;
    const box = rect.current;
    if (!tip || !el || !box) return;
    const place = tipPlace(box, { width: el.offsetWidth }, { width: window.innerWidth });
    if (place.left !== tip.left || place.top !== tip.top) setTip({ ...tip, ...place });
  }, [tip]);

  useEffect(() => {
    const root = wrap.current;
    if (!root) return;
    const buttonOf = (e: Event) => (e.target as HTMLElement | null)?.closest<HTMLElement>("button") ?? null;
    let held = false;
    const over = (e: PointerEvent) => { const b = buttonOf(e); if (b && e.pointerType === "mouse") show(b, "mouse"); };
    const out = (e: PointerEvent) => { if (buttonOf(e) && e.pointerType === "mouse") hide(TIP_HIDE_MS); };
    const down = (e: PointerEvent) => {
      if (e.pointerType === "touch") { const b = buttonOf(e); if (b) { held = true; show(b, "touch"); } } else hide();
    };
    const up = (e: PointerEvent) => { if (e.pointerType === "touch" && held) { held = false; hide(TIP_TOUCH_HIDE_MS); } };
    const focus = (e: FocusEvent) => { const b = buttonOf(e); if (b && b.matches(":focus-visible")) show(b, "keyboard"); };
    const blur = () => hide();
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") hide(); };
    const scroll = () => hide();
    root.addEventListener("pointerover", over); root.addEventListener("pointerout", out);
    root.addEventListener("pointerdown", down); root.addEventListener("pointerup", up);
    root.addEventListener("focusin", focus); root.addEventListener("focusout", blur);
    document.addEventListener("keydown", key); window.addEventListener("scroll", scroll, true);
    return () => {
      root.removeEventListener("pointerover", over); root.removeEventListener("pointerout", out);
      root.removeEventListener("pointerdown", down); root.removeEventListener("pointerup", up);
      root.removeEventListener("focusin", focus); root.removeEventListener("focusout", blur);
      document.removeEventListener("keydown", key); window.removeEventListener("scroll", scroll, true);
      clear();
    };
  }, [wrap, show, hide]);

  return tip === null ? null : (
    <div ref={tipRef} role="tooltip" className={styles.tip} style={{ left: tip.left, top: tip.top }}>
      <span className={styles.tipName}>{tip.tip.name}</span>
      {tip.tip.shortcut ? <span className={styles.kbd}>{tip.tip.shortcut}</span> : null}
      {tip.tip.description ? <p className={styles.tipText}>{tip.tip.description}</p> : null}
    </div>
  );
}

const LOOKS: readonly { id: ToolbarLook; label: string }[] = [
  { id: "icons", label: t.lookIcons }, { id: "both", label: t.lookBoth }, { id: "words", label: t.lookWords },
];

/** "Prilagodi alatnu traku": the look, and for each tool its place and whether it is on the toolbar or in Više. */
export function CustomiseToolbarDialog({ open, groups, prefs, intro, onChange, onClose }: {
  open: boolean;
  groups: readonly EditorToolbarGroup[];
  prefs: ToolbarPrefs;
  /** Which layout the person is arranging. */
  intro: "write" | "review" | "locked";
  onChange: (next: ToolbarPrefs) => void;
  onClose: () => void;
}) {
  const base = customisableIds(groups);
  const order = arrangedIds(base, prefs);
  const byId = new Map(groups.flatMap((g) => g.actions).map((a) => [a.id, a] as const));
  const introText = intro === "locked" ? t.customiseIntroLocked : intro === "review" ? t.customiseIntroReview : t.customiseIntroWrite;
  return (
    <Dialog open={open} title={t.customise} onClose={onClose}
      actions={<><Button tone="quiet" onClick={() => onChange(resetPrefs())}>{t.reset}</Button><Button onClick={onClose}>{t.done}</Button></>}>
      <p>{introText}</p>
      <p className={styles.help}>{t.customiseHelp}</p>
      <h3>{t.lookTitle}</h3>
      <div className={styles.chips} role="group" aria-label={t.lookTitle}>
        {LOOKS.map((l) => (
          <Button key={l.id} tone={prefs.look === l.id ? "primary" : "quiet"} aria-pressed={prefs.look === l.id} onClick={() => onChange(setLook(prefs, l.id))}>{l.label}</Button>
        ))}
      </div>
      <p className={styles.help}>{t.lookHelp}</p>
      <h3>{t.left}</h3>
      <ul className={styles.rows}>
        {order.map((id, i) => {
          const action = byId.get(id);
          if (!action) return null;
          const off = prefs.off.includes(id);
          return (
            <li key={id} className={styles.row}>
              <span className={styles.rowName}>{action.label}</span>
              <Button tone="quiet" aria-label={`${t.moveLeft}: ${action.label}`} disabled={i === 0} onClick={() => onChange(moveTool(base, prefs, id, -1))}>←</Button>
              <Button tone="quiet" aria-label={`${t.moveRight}: ${action.label}`} disabled={i === order.length - 1} onClick={() => onChange(moveTool(base, prefs, id, 1))}>→</Button>
              <Button tone={off ? "quiet" : "primary"} aria-pressed={!off} onClick={() => onChange(toggleTool(prefs, id))}>{off ? t.inMore : t.onToolbar}</Button>
            </li>
          );
        })}
      </ul>
    </Dialog>
  );
}

/** The context button and its menu; hidden where the cursor has nothing of its own to offer. */
function ContextButton({ place, editable, onAction }: { place: CursorPlace; editable: boolean; onAction: (id: ContextAction) => void }) {
  const [anchor, setAnchor] = useState<MenuPoint | null>(null);
  const model = contextButton(place, editable);
  if (model === null) return null;
  const entries: MenuEntry[] = model.items.map((i) => ({ kind: "item", id: i.id, label: i.checked ? `✓ ${i.label}` : i.label, hint: i.hint }));
  return (
    <span className={styles.ctx}>
      <Button tone="quiet" aria-haspopup="menu" title={model.description}
        onClick={(e) => { const b = e.currentTarget.getBoundingClientRect(); setAnchor({ x: b.left, y: b.bottom }); }}>{model.label} ▾</Button>
      <ContextMenu anchor={anchor} entries={entries} label={model.label} onClose={() => setAnchor(null)}
        onSelect={(id) => { setAnchor(null); onAction(id as ContextAction); }} />
    </span>
  );
}

export type ToolbarBehaviourProps = {
  groups: readonly EditorToolbarGroup[];
  prefs: ToolbarPrefs;
  onPrefs: (next: ToolbarPrefs) => void;
  /** Tools that do not fit the width go to Više; the shell measures and reports them (the prototype's fit()). */
  collapsed?: readonly string[];
  place?: CursorPlace;
  editable: boolean;
  intro?: "write" | "review" | "locked";
  onContextAction?: (id: ContextAction) => void;
};

/** The toolbar with its tool tips, look, Više, customising and context button. */
export function ToolbarWithBehaviour({ groups, prefs, onPrefs, collapsed = [], place = { kind: "text" }, editable, intro = "write", onContextAction }: ToolbarBehaviourProps) {
  const wrap = useRef<HTMLDivElement>(null);
  const [customising, setCustomising] = useState(false);
  const [moreAt, setMoreAt] = useState<MenuPoint | null>(null);
  const arranged = arrangeToolbar(groups, prefs, collapsed);
  const moreGroup: EditorToolbarGroup = { id: "more", label: t.more, actions: [{
    id: MORE_ID, label: t.more, icon: "chevronDown",
    onSelect: () => {
      const b = wrap.current?.querySelector<HTMLElement>(`button[aria-label="${t.more}"]`)?.getBoundingClientRect();
      setMoreAt(b ? { x: b.left, y: b.bottom } : { x: 0, y: 0 });
    },
  }] };
  const drawn = [...arranged.groups, moreGroup];

  const lookup = useCallback((label: string) => {
    const all = [...groups.flatMap((g) => g.actions), ...moreGroup.actions];
    const found = all.find((a) => a.label === label);
    return found ? { id: found.id, name: found.label, shortcut: found.shortcut } : null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groups]);
  const tip = useToolTip(wrap, lookup);

  // The browser's own title would show beside the tool tip: the name stays in aria-label.
  useEffect(() => { wrap.current?.querySelectorAll("button[title]").forEach((b) => b.removeAttribute("title")); });

  const moreEntries: MenuEntry[] = [
    ...arranged.more.map((a): MenuEntry => ({ kind: "item", id: a.id, label: a.label, hint: displayShortcut(a.shortcut) ?? undefined, disabled: a.disabled })),
    { kind: "item", id: "customise", label: t.customise },
  ];

  return (
    <div ref={wrap} className={styles.wrap} data-look={prefs.look}>
      <EditorToolbar groups={drawn} />
      <ContextButton place={place} editable={editable} onAction={onContextAction ?? (() => undefined)} />
      <ContextMenu anchor={moreAt} entries={moreEntries} label={t.more} onClose={() => setMoreAt(null)}
        onSelect={(id) => {
          setMoreAt(null);
          if (id === "customise") return setCustomising(true);
          arranged.more.find((a) => a.id === id)?.onSelect();
        }} />
      {tip}
      <CustomiseToolbarDialog open={customising} groups={groups} prefs={prefs} intro={intro} onChange={onPrefs} onClose={() => setCustomising(false)} />
    </div>
  );
}

/** "Brzi alati": above the keyboard on a phone, while the editor has the focus. */
export function MobileQuickBar({ editable, focused, dialogOpen = false, canUndo, onTool }: {
  editable: boolean; focused: boolean; dialogOpen?: boolean; canUndo: boolean; onTool: (id: QuickTool["id"]) => void;
}) {
  const [width, setWidth] = useState(() => (typeof window === "undefined" ? 1024 : window.innerWidth));
  const [inset, setInset] = useState(0);
  useEffect(() => {
    const measure = () => {
      setWidth(window.innerWidth);
      const v = window.visualViewport;
      setInset(keyboardInset(window.innerHeight, v ? { height: v.height, offsetTop: v.offsetTop } : null));
    };
    measure();
    window.addEventListener("resize", measure);
    window.visualViewport?.addEventListener("resize", measure);
    return () => { window.removeEventListener("resize", measure); window.visualViewport?.removeEventListener("resize", measure); };
  }, []);
  if (!quickBarVisible({ width, editable, focused, dialogOpen })) return null;
  return (
    <div role="toolbar" aria-label={t.quickTools} className={`${styles.quick} ${styles.fixedBottom}`} style={{ ["--keyboard-inset" as string]: `${inset}px` }}
      // A press in the bar must not take the focus (and the selection) out of the text.
      onPointerDown={(e) => e.preventDefault()}>
      {QUICK_TOOLS.map((q) => (
        <button key={q.id} type="button" aria-label={q.label} disabled={q.id === "undo" && !canUndo} onClick={() => onTool(q.id)}>{q.label}</button>
      ))}
    </div>
  );
}

/** Manji / Veći tekst: the size is one of five steps; the shell shows the toast once the size is set. */
export function TextSizeControls({ zoom, onZoom }: { zoom: number; onZoom: (next: number) => void }) {
  return (
    <span role="group" aria-label={t.textSizeGroup} className={styles.sizeGroup}>
      <Button tone="quiet" disabled={!canStep(zoom, -1)} onClick={() => onZoom(stepZoom(zoom, -1))}>{t.textSmaller}</Button>
      <Button tone="quiet" disabled={!canStep(zoom, 1)} onClick={() => onZoom(stepZoom(zoom, 1))}>{t.textLarger} ({zoomPercent(zoom)} %)</Button>
    </span>
  );
}

export { QUICK_MAX_WIDTH };
