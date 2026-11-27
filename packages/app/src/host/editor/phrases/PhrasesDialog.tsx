"use client";

// ED-111: "Fraze" (prototype app.js dialog `phrases`, opened from Umetni › Fraza and "/fraza").
// Chips choose the kind of phrase; a phrase goes in at the caret with its first "…" selected.
import { Button, Chip, Dialog } from "@ductura/ui";
import type { Editor } from "@tiptap/core";
import { useState } from "react";

import { phrasesHr as t } from "./messages.hr";
import { insertPhrase, PHRASES } from "./phrases-model";
import styles from "./Phrases.module.css";

export function PhrasesDialog({ editor, onClose, category = 0 }: { editor: Editor; onClose: () => void; category?: number }) {
  const [at, setAt] = useState(Math.min(Math.max(category, 0), PHRASES.length - 1));
  const [, list] = PHRASES[at]!;
  const pick = (phrase: string) => {
    onClose();
    // After the dialog has handed the focus back, so the selected "…" stays in the text.
    setTimeout(() => insertPhrase(editor, phrase), 0);
  };
  return (
    <Dialog open title={t.title} onClose={onClose} actions={<Button onClick={onClose}>{t.close}</Button>}>
      <p className={styles.intro}>{t.intro}</p>
      <div className={styles.chips} role="group" aria-label={t.categories}>
        {PHRASES.map(([name], i) => <Chip key={name} pressed={i === at} onClick={() => setAt(i)}>{name}</Chip>)}
      </div>
      <ul className={styles.list}>
        {list.map((phrase) => <li key={phrase}>
          <button type="button" className={styles.phrase} onClick={() => pick(phrase)}>{phrase}</button>
        </li>)}
      </ul>
    </Dialog>
  );
}
