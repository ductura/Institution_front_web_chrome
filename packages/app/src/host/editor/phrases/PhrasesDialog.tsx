"use client";

/** ED-94: the prototype's "Fraze" dialog: the groups as chips, the chosen group's phrases as buttons. */
import { useState } from "react";
import { Button, Chip, Dialog } from "@ductura/ui";

import { PHRASE_GROUPS, phrasesHr as t } from "./phrases";
import styles from "./Phrases.module.css";

export function PhrasesDialog({ onPick, onClose, group = 0 }: {
  onPick: (phrase: string) => void; onClose: () => void;
  /** The group shown first. */
  group?: number;
}) {
  const [at, setAt] = useState(() => (PHRASE_GROUPS[group] ? group : 0));
  const shown = PHRASE_GROUPS[at] ?? PHRASE_GROUPS[0]!;
  return (
    <Dialog open title={t.title} onClose={onClose} actions={<Button tone="quiet" onClick={onClose}>{t.close}</Button>}>
      <p className={styles.intro}>{t.intro}</p>
      <div role="group" aria-label={t.groups} className={styles.groups}>
        {PHRASE_GROUPS.map((g, i) => <Chip key={g.name} pressed={i === at} onClick={() => setAt(i)}>{g.name}</Chip>)}
      </div>
      <ul className={styles.list} aria-label={shown.name}>
        {shown.phrases.map((p) => <li key={p}><button type="button" className={styles.phrase} onClick={() => onPick(p)}>{p}</button></li>)}
      </ul>
    </Dialog>
  );
}
