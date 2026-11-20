"use client";

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";

import { Dialog } from "../Dialog";
import styles from "./CommandPalette.module.css";
import {
  moveIndex, pushRecent, readRecent, saveRecent, sections, visibleCommands, type Command,
} from "./palette-logic";

export type CommandPaletteProps = {
  open: boolean;
  commands: readonly Command[];
  /** Runs the chosen command; the palette closes first. */
  onRun: (id: string) => void;
  onClose: () => void;
};

/**
 * Command palette (Ctrl+K), on the shared Dialog: search field, listbox moved with
 * Up/Down/Enter, groups, disabled items shown. Recent commands are kept locally.
 */
export function CommandPalette({ open, commands, onRun, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [recent, setRecent] = useState<string[]>([]);
  const [active, setActive] = useState(-1);
  const listId = useId();
  const field = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setRecent(readRecent());
  }, [open]);

  const items = useMemo(() => visibleCommands(commands, query, recent), [commands, query, recent]);
  const groups = useMemo(() => sections(items, query, recent), [items, query, recent]);
  // Display order follows the groups, so keyboard order does too.
  const flat = useMemo(() => groups.flatMap((g) => g.items), [groups]);
  useEffect(() => setActive(flat.findIndex((c) => !c.disabled)), [flat]);

  const run = (command: Command | undefined) => {
    if (!command || command.disabled) return;
    const next = pushRecent(recent, command.id);
    saveRecent(next);
    onClose();
    onRun(command.id);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setActive(moveIndex(flat, active, event.key === "ArrowDown" ? 1 : -1));
    } else if (event.key === "Enter") {
      event.preventDefault();
      run(flat[active]);
    }
  };

  return (
    <Dialog open={open} title="Naredbe" onClose={onClose} initialFocus={field}
      actions={<span className={styles.foot}>↑ ↓ odabir · Enter potvrda · Esc zatvori</span>}>
      <div onKeyDown={onKeyDown}>
        <input ref={field} className={styles.field} type="search" role="combobox" aria-expanded="true"
          aria-controls={listId} aria-autocomplete="list" aria-label="Pretraga naredbi"
          aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
          placeholder="Upišite naredbu" autoComplete="off" value={query}
          onChange={(e) => setQuery(e.target.value)} />
        <div id={listId} role="listbox" aria-label="Naredbe" className={styles.list}>
          {flat.length === 0 ? <p className={styles.empty}>Nema takve naredbe.</p> : null}
          {groups.map((g) => (
            <div key={g.title} role="group" aria-label={g.title}>
              <div className={styles.group} aria-hidden="true">{g.title}</div>
              {g.items.map((c) => {
                const i = flat.indexOf(c);
                return (
                  <div key={c.id} id={`${listId}-${i}`} role="option" className={styles.item}
                    aria-selected={i === active} aria-disabled={c.disabled || undefined}
                    onMouseMove={() => { if (!c.disabled) setActive(i); }}
                    onClick={() => run(c)}>
                    <span>{c.label}</span>{c.hint ? <small>{c.hint}</small> : null}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </Dialog>
  );
}

/** Ctrl/Cmd+K toggles; a hook so the host decides where to listen. */
export function usePaletteShortcut(toggle: () => void): void {
  useEffect(() => {
    const on = (e: globalThis.KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === "k") {
        e.preventDefault();
        toggle();
      }
    };
    document.addEventListener("keydown", on);
    return () => document.removeEventListener("keydown", on);
  }, [toggle]);
}
