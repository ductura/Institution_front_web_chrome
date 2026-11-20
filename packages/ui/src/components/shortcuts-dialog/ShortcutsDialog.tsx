"use client";

import { Button } from "../Button";
import { Dialog } from "../Dialog";
import styles from "./ShortcutsDialog.module.css";

export type Shortcut = { keys: string; label: string };
export type ShortcutGroup = { title: string; items: readonly Shortcut[] };

export type ShortcutsDialogProps = {
  open: boolean;
  groups: readonly ShortcutGroup[];
  onClose: () => void;
};

/** Shortcut list by groups (Ctrl+/), on the shared Dialog. */
export function ShortcutsDialog({ open, groups, onClose }: ShortcutsDialogProps) {
  return (
    <Dialog open={open} title="Prečaci" onClose={onClose}
      actions={<Button tone="quiet" onClick={onClose}>Zatvori</Button>}>
      <p className={styles.note}>Na Macu umjesto Ctrl vrijedi Cmd.</p>
      <div className={styles.scroll}>
        {groups.map((g) => (
          <section key={g.title} aria-label={g.title}>
            <h3 className={styles.title}>{g.title}</h3>
            <ul className={styles.list}>
              {g.items.map((s) => (
                <li key={`${s.keys}|${s.label}`} className={styles.row}>
                  <span>{s.label}</span><kbd className={styles.kbd}>{s.keys}</kbd>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </Dialog>
  );
}

/** The prototype's groups (INVENTAR-editor, "Prečaci"), for hosts that want the default list. */
export const DEFAULT_SHORTCUT_GROUPS: readonly ShortcutGroup[] = [
  { title: "Pisanje", items: [
    { keys: "Ctrl+Z", label: "Poništi" }, { keys: "Ctrl+Y", label: "Ponovi" },
    { keys: "Ctrl+B", label: "Podebljano" }, { keys: "Ctrl+I", label: "Kurziv" },
    { keys: "@", label: "Navod iz Vaših izvora" },
  ] },
  { title: "Kretanje i uređivanje", items: [
    { keys: "Ctrl+K", label: "Naredbe: sve na jednom mjestu" }, { keys: "Ctrl+F", label: "Traži i zamijeni" },
    { keys: "Alt+↑ ili ↓", label: "Premjesti rečenicu" }, { keys: "Alt+Shift+↑ ili ↓", label: "Premjesti poglavlje" },
    { keys: "Ctrl+Alt+M", label: "Komentar uz označeni tekst" },
  ] },
  { title: "Prikaz", items: [
    { keys: "Ctrl+.", label: "Način fokusa" }, { keys: "Ctrl+\\", label: "Struktura rada" },
    { keys: "Ctrl+/", label: "Ovaj popis" }, { keys: "Esc", label: "Zatvara prozor ili izbornik" },
  ] },
];
