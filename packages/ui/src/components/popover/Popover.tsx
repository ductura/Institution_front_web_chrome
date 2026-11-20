"use client";

import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode, type RefObject } from "react";

import { returnTarget } from "../dialog-focus";
import { isOutside, placePopover } from "./popover-position";
import styles from "./Popover.module.css";

export type PopoverProps = {
  open: boolean;
  /** The element it sits beside; also where the focus returns on Escape. */
  anchor: RefObject<HTMLElement | null>;
  /** Names it for assistive technology. */
  label: string;
  children?: ReactNode;
  /** Escape or a click outside: the popover never closes itself. */
  onClose: () => void;
  /** false: shown in the page flow, not anchored (the catalogue and previews). */
  floating?: boolean;
};

/**
 * The shared popover (UI-6A): a small raised panel anchored to an element. It
 * is not modal, so the page stays live; Escape and a click outside call
 * `onClose`, and Escape gives the focus back to the anchor.
 */
export function Popover({ open, anchor, label, children, onClose, floating = true }: PopoverProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);

  // Placed after layout, from the measured size, before the browser paints.
  useLayoutEffect(() => {
    const el = ref.current;
    const target = anchor.current;
    if (!open || !floating || el === null || target === null) return;
    const place = () => setPosition(placePopover(target.getBoundingClientRect(), { width: el.offsetWidth, height: el.offsetHeight }, { width: innerWidth, height: innerHeight }));
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [open, floating, anchor]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (isOutside(event.target as Node | null, ref.current, anchor.current)) onClose();
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open, anchor, onClose]);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Escape") return;
    event.preventDefault();
    event.stopPropagation();
    returnTarget(anchor.current, (el) => el.isConnected)?.focus();
    onClose();
  };

  if (!open) return null;
  const style = floating ? { left: position?.x ?? 0, insetBlockStart: position?.y ?? 0, visibility: position ? undefined : ("hidden" as const) } : undefined;
  return (
    <div ref={ref} role="dialog" aria-label={label} className={floating ? styles.popover : `${styles.popover} ${styles.inline}`}
      style={style} onKeyDown={onKeyDown}>
      {children}
    </div>
  );
}
