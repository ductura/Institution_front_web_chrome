import type { WordRange } from "@ductura/ui";

import { chapterLengthHr as t } from "./messages.hr";
import styles from "./ChapterLength.module.css";

export function ChapterLength({ words, target }: { words: number; target?: WordRange }) {
  const min = target?.min ?? null;
  const max = target?.max ?? null;
  const goal = min === null ? (max === null ? null : t.maximum(max))
    : max === null ? t.minimum(min) : t.range(min, max);
  return <span className={styles.length}>{t.words(words)}{goal && ` · ${goal}`}</span>;
}
