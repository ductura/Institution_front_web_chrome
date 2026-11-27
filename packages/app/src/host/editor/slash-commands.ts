"use client";

/**
 * ED-46 (P2-18): the "/" commands whose dialog lives elsewhere on the page. The
 * student's toolbar owns the footnote and cross-reference dialogs (Umetni); the
 * "/" menu (SourcesMention) sits in another part of the work page. The toolbar
 * offers what it can open for its editor here and the menu reads it, so
 * `/fusnota` and `/ref` open the same dialog as Umetni, and stay disabled
 * ("nije u pilotu") whenever Umetni would.
 */
import { useEffect, useRef, useSyncExternalStore } from "react";

// ED-111: "/fraza" opens the toolbar's "Fraze" dialog.
export type SlashCommand = "fusnota" | "ref" | "fraza";
export type SlashCommands = Partial<Record<SlashCommand, () => void>>;

const NONE: SlashCommands = Object.freeze({});
const offered = new WeakMap<object, SlashCommands>();
const listeners = new Set<() => void>();
const changed = () => { for (const listener of listeners) listener(); };

/** What is offered for `editor` now; the same object until the offer changes. */
export function slashCommandsOf(editor: object | null): SlashCommands {
  return (editor && offered.get(editor)) || NONE;
}

/** Offers `commands` for `editor` until `withdraw()`; a later offer replaces it. */
export function offerSlashCommands(editor: object, commands: SlashCommands): () => void {
  offered.set(editor, commands);
  changed();
  return () => {
    if (offered.get(editor) !== commands) return;
    offered.delete(editor);
    changed();
  };
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

/** The "/" menu's side: re-renders when the offer for its editor changes. */
export function useSlashCommands(editor: object | null): SlashCommands {
  return useSyncExternalStore(subscribe, () => slashCommandsOf(editor), () => NONE);
}

/**
 * The toolbar's side. The offer changes only when which commands are available changes; each one calls
 * the latest function, so a new render of the toolbar does not re-render the menu.
 */
export function useOfferSlashCommands(editor: object | null, commands: SlashCommands): void {
  const latest = useRef(commands);
  latest.current = commands;
  const keys = (Object.keys(commands) as SlashCommand[]).filter((k) => commands[k]).sort().join(",");
  useEffect(() => {
    if (!editor || !keys) return;
    const stable: SlashCommands = {};
    for (const key of keys.split(",") as SlashCommand[]) stable[key] = () => latest.current[key]?.();
    return offerSlashCommands(editor, stable);
  }, [editor, keys]);
}
