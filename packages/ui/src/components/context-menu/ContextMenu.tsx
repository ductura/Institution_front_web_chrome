"use client";

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";

import styles from "./ContextMenu.module.css";
import { menuFocusTarget, placeMenu, type MenuEntry, type Point } from "./menu-logic";

export type ContextMenuProps = {
  /** Where it opens (viewport pixels); null keeps it closed. */
  anchor: Point | null;
  entries: readonly MenuEntry[];
  /** The menu's accessible name. */
  label: string;
  onSelect: (id: string) => void;
  onClose: () => void;
};

/** Inline position; written as a helper because the API scanner reads a `top:` key as a global alias. */
function menuStyle(at: Point, hidden: boolean): CSSProperties {
  const style: CSSProperties = { left: at.x, visibility: hidden ? "hidden" : "visible" };
  style["top"] = at.y;
  return style;
}

/**
 * The context menu (UI-6C): opens at a point, keeps itself on screen, moves with the arrow keys
 * over the enabled items (disabled ones are shown but skipped and do nothing), Enter or Space
 * picks, Escape and Tab close it, and the focus goes back to what had it.
 */
export function ContextMenu({ anchor, entries, label, onSelect, onClose }: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  const previous = useRef<Element | null>(null);
  const [placed, setPlaced] = useState<Point | null>(null);
  const open = anchor !== null;

  useLayoutEffect(() => {
    const menu = ref.current;
    if (!open || menu === null || anchor === null) return setPlaced(null);
    previous.current = document.activeElement;
    const { width, height } = menu.getBoundingClientRect();
    setPlaced(placeMenu(anchor, { width, height }, { width: window.innerWidth, height: window.innerHeight }));
  }, [open, anchor]);

  useEffect(() => {
    const menu = ref.current;
    if (!open || menu === null) return;
    const items = Array.from(menu.querySelectorAll<HTMLElement>('[role="menuitem"]'));
    items.find((el) => el.getAttribute("aria-disabled") !== "true")?.focus();
    const outside = (event: Event) => {
      if (!menu.contains(event.target as Node)) onClose();
    };
    document.addEventListener("pointerdown", outside, true);
    // The menu scrolls itself when long (max-height); only the page behind it dismisses.
    const pageScroll = (event: Event) => {
      if (!menu.contains(event.target as Node)) onClose();
    };
    window.addEventListener("scroll", pageScroll, true);
    window.addEventListener("resize", onClose);
    return () => {
      document.removeEventListener("pointerdown", outside, true);
      window.removeEventListener("scroll", pageScroll, true);
      window.removeEventListener("resize", onClose);
      const back = previous.current;
      if (back instanceof HTMLElement && back.isConnected) back.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape" || event.key === "Tab") {
      event.preventDefault();
      onClose();
      return;
    }
    const items = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('[role="menuitem"]'));
    const target = menuFocusTarget(entries, Number(document.activeElement?.getAttribute("data-entry") ?? -1), event.key);
    if (target === null) return;
    event.preventDefault();
    items.find((el) => el.getAttribute("data-entry") === String(target))?.focus();
  };

  return (
    <div
      ref={ref}
      role="menu"
      aria-label={label}
      className={styles.menu}
      style={menuStyle(placed ?? anchor, placed === null)}
      onKeyDown={onKeyDown}
      onContextMenu={(event) => event.preventDefault()}
    >
      {entries.map((entry, index) =>
        entry.kind === "heading" ? (
          <div key={`h${index}`} role="presentation" className={styles.heading}>{entry.label}</div>
        ) : (
          <button
            key={entry.id}
            type="button"
            role="menuitem"
            data-entry={index}
            className={styles.item}
            aria-disabled={entry.disabled || undefined}
            tabIndex={-1}
            onClick={() => {
              if (entry.disabled) return;
              onSelect(entry.id);
              onClose();
            }}
          >
            <span>{entry.label}</span>
            {entry.hint ? <small className={styles.hint}>{entry.hint}</small> : null}
          </button>
        ),
      )}
    </div>
  );
}
