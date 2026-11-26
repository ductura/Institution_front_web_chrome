"use client";

// WEB-V13-UREDNIK: the list of slides: choose one, add, remove, move.
import { Button } from "@ductura/ui";
import type { Slide } from "../../../../../editor-core/src/slides/index.ts";
import { slideTitle } from "./editor-model.ts";
import { fill, slidesEditorText as t } from "./messages.hr.ts";
import styles from "./editor.module.css";

export type SlideListProps = {
  slides: readonly Slide[];
  selectedId: string;
  readOnly: boolean;
  onSelect: (slideId: string) => void;
  onAdd: () => void;
  onRemove: () => void;
  onMove: (delta: number) => void;
};

export function SlideList({ slides, selectedId, readOnly, onSelect, onAdd, onRemove, onMove }: SlideListProps) {
  const at = slides.findIndex((slide) => slide.id === selectedId);
  return (
    <nav aria-label={t.listLabel} className={styles.stack}>
      <h2>{t.listTitle}</h2>
      <ol className={styles.list}>
        {slides.map((slide, index) => {
          const title = slideTitle(slide) ?? fill(t.slideN, { n: index + 1 });
          return (
            <li key={slide.id} className={styles.listItem}>
              <Button tone={slide.id === selectedId ? "primary" : "secondary"} size="small" aria-current={slide.id === selectedId ? "true" : undefined}
                aria-label={fill(t.selectSlide, { n: index + 1, title })} onClick={() => onSelect(slide.id)}>
                {index + 1}. {title}
              </Button>
            </li>
          );
        })}
      </ol>
      {!readOnly && (
        <div className={styles.row}>
          <Button tone="secondary" size="small" onClick={onAdd}>{t.add}</Button>
          <Button tone="secondary" size="small" aria-disabled={slides.length === 1 || undefined} onClick={onRemove}>{t.remove}</Button>
          <Button tone="secondary" size="small" aria-disabled={at <= 0 || undefined} onClick={() => onMove(-1)}>{t.moveUp}</Button>
          <Button tone="secondary" size="small" aria-disabled={at === slides.length - 1 || undefined} onClick={() => onMove(1)}>{t.moveDown}</Button>
        </div>
      )}
    </nav>
  );
}
