"use client";

// WEB-V13-NASTAVNIK-PREGLED: the comparison of two revisions on the level of slides: added, removed, changed.
// Reading only; no marks, no ranking, no verdict. Both documents come already verified.
import type { SlidesDocument } from "../../../../../editor-core/src/slides/index.ts";
import { compareSlides, slideTitle, type ChangePart } from "./model.ts";
import { fill, slidesReviewText as t } from "./messages.hr.ts";

const PART_TEXT: Readonly<Record<ChangePart, string>> = {
  layout: t.changeLayout, blocks: t.changeBlocks, notes: t.changeNotes, position: t.changePosition,
};

export function SlideDiff({ older, newer }: { older: SlidesDocument; newer: SlidesDocument }) {
  const result = compareSlides(older, newer);
  return (
    <section aria-label={t.compareTitle}>
      <h2>{t.compareTitle}</h2>
      <p>{fill(t.compareSummary, { added: result.added, removed: result.removed, changed: result.changed })}</p>
      {result.changes.length === 0 ? <p role="status">{t.compareNone}</p> : (
        <ul>
          {result.changes.map((change) => {
            const slide = change.kind === "changed" ? change.after : change.slide;
            const label = change.kind === "added" ? t.added : change.kind === "removed" ? t.removed : t.changed;
            return (
              <li key={`${change.kind}:${slide.id}`}>
                <strong>{label}</strong>{" "}
                {fill(t.slideN, { n: change.index + 1 })}: {slideTitle(slide) ?? t.untitled}
                {change.kind === "changed" ? <> — {fill(t.changedParts, { parts: change.parts.map((part) => PART_TEXT[part]).join(", ") })}</> : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
