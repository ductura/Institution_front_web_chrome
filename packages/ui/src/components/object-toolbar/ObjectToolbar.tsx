"use client";

import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type RefObject } from "react";

import { returnTarget } from "../dialog-focus";
import { isOutside, placePopover } from "../popover/popover-position";
import { objectToolbarHr } from "./messages.hr";
import styles from "./ObjectToolbar.module.css";
import { toolbarIndex } from "./toolbar-logic";

export type ObjectToolbarAction = {
  id: string;
  label: string;
  onSelect: () => void;
  /** A toggle: shown with aria-pressed. */
  pressed?: boolean;
};

export type ObjectToolbarProps = {
  open: boolean;
  /** The object (table, image) it floats beside; Escape gives the focus back to it. */
  anchor: RefObject<HTMLElement | null>;
  actions: readonly ObjectToolbarAction[];
  /** Escape or a click outside: the toolbar never closes itself. */
  onClose: () => void;
  label?: string;
  /** false: shown in the page flow, not anchored (the catalogue and previews). */
  floating?: boolean;
};

/**
 * The floating toolbar beside an object (UI-10A). One Tab stop: arrows, Home
 * and End move between the buttons; Escape closes it and returns to the object.
 */
export function ObjectToolbar({ open, anchor, actions, onClose, label = objectToolbarHr.label, floating = true }: ObjectToolbarProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    const target = anchor.current;
    if (!open || !floating || el === null || target === null) return;
    const place = () => setPosition(placePopover(target.getBoundingClientRect(), { width: el.offsetWidth, height: el.offsetHeight }, { width: innerWidth, height: innerHeight }));
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, floating, anchor]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (isOutside(event.target as Node | null, ref.current, anchor.current)) onClose();
    };
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      returnTarget(anchor.current, (el) => el.isConnected)?.focus();
      onClose();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown, true);
    };
  }, [open, anchor, onClose]);

  const onToolbarKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const next = toolbarIndex(active, actions.length, event.key);
    if (next === null) return;
    event.preventDefault();
    setActive(next);
    event.currentTarget.querySelectorAll<HTMLButtonElement>("button")[next]?.focus();
  };

  if (!open) return null;
  const style = floating ? { left: position?.x ?? 0, insetBlockStart: position?.y ?? 0, visibility: position ? undefined : ("hidden" as const) } : undefined;
  return (
    <div ref={ref} role="toolbar" aria-label={label} aria-orientation="horizontal" style={style}
      className={floating ? styles.toolbar : `${styles.toolbar} ${styles.inline}`} onKeyDown={onToolbarKeyDown}>
      {actions.map((a, i) => (
        <button key={a.id} type="button" className={styles.action} tabIndex={i === active ? 0 : -1}
          aria-pressed={a.pressed} onFocus={() => setActive(i)} onClick={a.onSelect}>
          {a.label}
        </button>
      ))}
    </div>
  );
}
