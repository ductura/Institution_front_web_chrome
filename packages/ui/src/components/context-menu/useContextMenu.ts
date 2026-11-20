"use client";

import { useCallback, useState, type KeyboardEvent, type MouseEvent } from "react";

import { isMenuKey, menuOpensFor, type Point } from "./menu-logic";

/**
 * Props for the area that owns a context menu: right click opens it at the pointer,
 * Shift+F10 or the menu key at the area's top left; Shift+right click stays the browser's own menu.
 * `enabled` false (a locked document) opens nothing and leaves the browser's menu alone.
 */
export function useContextMenu(enabled = true) {
  const [anchor, setAnchor] = useState<Point | null>(null);
  const close = useCallback(() => setAnchor(null), []);

  const onContextMenu = (event: MouseEvent<HTMLElement>) => {
    const native = event.nativeEvent as PointerEvent;
    // A keyboard-made contextmenu event has no pointer position; onKeyDown already handled it.
    const fromKeyboard = event.clientX === 0 && event.clientY === 0;
    if (!enabled || fromKeyboard || !menuOpensFor({ shiftKey: event.shiftKey, pointerType: native.pointerType }, false)) return;
    event.preventDefault();
    setAnchor({ x: event.clientX, y: event.clientY });
  };

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (!enabled || !isMenuKey(event)) return;
    event.preventDefault();
    const box = event.currentTarget.getBoundingClientRect();
    setAnchor({ x: box.left, y: box.top });
  };

  return { anchor, close, areaProps: { onContextMenu, onKeyDown } };
}
