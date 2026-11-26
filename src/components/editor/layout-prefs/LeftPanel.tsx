"use client";

import { Button, Details, PanelTabs } from "@ductura/ui";
import { useEditorState } from "@tiptap/react";
import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

import { blockPosition, currentHeading, numberedHeadings, type NumberedHeading } from "@/editor";
import { editorPanelLayoutsHr as t, messagesHr } from "@/lib/i18n/messages.hr";

import { ChapterLength } from "../../../../packages/app/src/host/editor/chapter-length/ChapterLength";
import { editorChapterWordCounts } from "../../../../packages/app/src/host/editor/chapter-length/chapter-length";
import { useChapterTargets } from "../../../../packages/app/src/host/editor/chapter-length/use-chapter-targets";
import { useLocalEditor } from "../LocalDocument";
import styles from "../SidePanels.module.css";
import type { PanelLayout } from "./preferences";

const w = messagesHr.workspace;
const headingKey = (heading: NumberedHeading) => heading.id ?? `pos-${heading.pos}`;
const headingLabel = (heading: NumberedHeading) => `${heading.number}. ${heading.title || messagesHr.outline.untitledHeading}`;

/** `footer` (ED-37) stands under the sections in every layout, as the prototype's rail footer. */
export type LeftSections = Partial<Record<"requirements" | "figures" | "stash" | "progress" | "deadlines" | "thread" | "history" | "chapter" | "footer", ReactNode>> & {
  /** ED-37 (P2-6): what a chapter row shows after its title and words (the state dot, "za popraviti"); in every layout. */
  chapterMarks?: (headingId: string, words: number) => ReactNode;
};

/** ED-37: the subchapters (level 3) that a folded chapter (level 2) hides in the list; the rest stay. */
export function visibleHeadings<H extends { level: number }>(headings: readonly H[], folded: (heading: H) => boolean): H[] {
  let hiding = false;
  return headings.filter((heading) => {
    if (heading.level <= 2) { hiding = heading.level === 2 && folded(heading); return true; }
    return !hiding;
  });
}

/** ED-37: the chapters (level 2) that have subchapters, the only ones with a fold button. */
export function foldable<H extends { level: number }>(headings: readonly H[]): Set<H> {
  return new Set(headings.filter((heading, index) => heading.level === 2 && (headings[index + 1]?.level ?? 0) > 2));
}

type Outline = { headings: NumberedHeading[]; current: NumberedHeading | undefined; words?: readonly number[] };

function ChapterCards({ outline, go, label }: {
  outline: Outline;
  go: (heading: NumberedHeading) => void;
  label: (heading: NumberedHeading) => ReactNode;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const returnTo = useRef<string | null>(null);
  const back = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const headings = outline.headings.filter(({ level }) => level !== 1);
  const chapterIndex = headings.findIndex((heading) => headingKey(heading) === open);
  const chapter = headings[chapterIndex];
  const firstChapter = headings.findIndex(({ level }) => level === 2);
  const { current } = outline;
  const active = current && (headings.findLast(({ level, pos }) => level === 2 && pos <= current.pos) ?? current);

  useLayoutEffect(() => {
    if (open !== null) back.current?.focus();
    else if (returnTo.current !== null) {
      Array.from(list.current?.querySelectorAll("button") ?? [])
        .find((button) => button.dataset.chapter === returnTo.current)?.focus();
      returnTo.current = null;
    }
  }, [open]);

  if (chapter) {
    const next = headings.findIndex((heading, index) => index > chapterIndex && heading.level <= chapter.level);
    const children = headings.slice(chapterIndex + 1, next === -1 ? undefined : next);
    return <div className={styles.chapterCards}>
      <Button ref={back} tone="quiet" onClick={() => setOpen(null)}>{t.allChapters}</Button>
      <Button tone="quiet" onClick={() => go(chapter)}>{label(chapter)}</Button>
      <h2>{t.subchapters}</h2>
      {children.map((heading) => <Button key={headingKey(heading)} tone="quiet" onClick={() => go(heading)}>
        {label(heading)}
      </Button>)}
      {children.length === 0 && <p>{t.noSubchapters}</p>}
    </div>;
  }

  return <div ref={list} className={styles.chapterCards}>
    {headings.filter((heading, index) => heading.level === 2 || firstChapter === -1 || index < firstChapter)
      .map((heading) => <Button key={headingKey(heading)} tone="quiet" data-chapter={headingKey(heading)}
        aria-current={heading === active ? "location" : undefined}
        onClick={() => { returnTo.current = headingKey(heading); setOpen(headingKey(heading)); }}>
        {label(heading)} <span aria-hidden="true">›</span>
      </Button>)}
    {headings.length === 0 && <p className="rail-empty">{w.structureEmpty}</p>}
  </div>;
}

export function LeftPanel({ layout, sections = {}, settings, onJump }: {
  layout: PanelLayout;
  sections?: LeftSections;
  settings: ReactNode;
  onJump: () => void;
}) {
  const editor = useLocalEditor();
  const data = useEditorState({ editor, selector: ({ editor: instance }): Outline => {
    if (!instance || instance.isDestroyed) return { headings: [], current: undefined };
    const { doc, selection } = instance.state;
    const headings = numberedHeadings(doc);
    return { headings, current: headings[currentHeading(headings, selection.from)], words: editorChapterWordCounts(doc) };
  } }) ?? { headings: [], current: undefined };
  const targets = useChapterTargets(editor !== null);
  const wordsByPosition = new Map(data.headings.map((heading, index) => [heading.pos, data.words?.[index]]));
  const label = (heading: NumberedHeading) => {
    const words = wordsByPosition.get(heading.pos);
    const target = heading.id ? targets.get(heading.id) : undefined;
    return <span>{headingLabel(heading)}{words !== undefined && <ChapterLength words={words} target={target} />}
      {heading.id && sections.chapterMarks?.(heading.id, words ?? 0)}</span>;
  };
  const [folded, setFolded] = useState<ReadonlySet<string>>(() => new Set());
  const withKids = foldable(data.headings);
  const allFolded = withKids.size > 0 && [...withKids].every((heading) => folded.has(headingKey(heading)));
  const fold = (heading: NumberedHeading) => setFolded((old) => {
    const next = new Set(old);
    if (!next.delete(headingKey(heading))) next.add(headingKey(heading));
    return next;
  });
  const go = (heading: NumberedHeading) => {
    if (!editor || editor.isDestroyed) return;
    const pos = heading.id ? blockPosition(editor.state.doc, heading.id) : heading.pos;
    if (pos === null) return;
    editor.chain().setTextSelection(pos + 1).scrollIntoView().run();
    onJump();
    requestAnimationFrame(() => { if (!editor.isDestroyed) editor.view.focus(); });
  };
  // "Povijest dokumenta" is a group only for a caller that gives it; others get no empty group.
  const content = Object.entries(t.leftSections).filter(([key]) => key !== "history" || sections.history !== undefined).map(([key, label]) => ({
    id: key, label, content: sections[key as Exclude<keyof LeftSections, "chapterMarks">] ?? <p className="rail-empty">{t.emptyGroup}</p>,
  }));
  const outline = data.headings.length ? <nav aria-label={messagesHr.outline.label}>
    {withKids.size > 0 && <Button tone="quiet" onClick={() => setFolded(allFolded ? new Set() : new Set([...withKids].map(headingKey)))}>
      {allFolded ? t.expandAll : t.collapseAll}
    </Button>}
    <ol className="outline">
      {visibleHeadings(data.headings, (heading) => folded.has(headingKey(heading))).map((heading) => <li key={headingKey(heading)} data-level={heading.level} className="outline__item">
        {withKids.has(heading) && <Button tone="quiet" aria-expanded={!folded.has(headingKey(heading))}
          aria-label={t.foldChapter(heading.title || messagesHr.outline.untitledHeading)} onClick={() => fold(heading)}>
          <span aria-hidden="true">{folded.has(headingKey(heading)) ? "▸" : "▾"}</span>
        </Button>}
        <Button tone="quiet" className="outline__link" aria-current={heading === data.current ? "location" : undefined}
          onClick={() => go(heading)}>{label(heading)}</Button>
      </li>)}
    </ol>
  </nav> : <p className="rail-empty">{w.structureEmpty}</p>;

  return <>
    <div className={styles.panelHeading}><span>{t.variants.left[layout]}</span>{settings}</div>
    {layout === "b" ? <PanelTabs label={w.structureLabel} tabs={[{ id: "structure", label: w.structure, content: <>{outline}{sections.chapter}</> }, ...content]} /> : <>
      {layout === "c" ? <ChapterCards outline={data} go={go} label={label} /> : outline}
      {sections.chapter}
      {content.map(({ id, label, content: section }) => <Details key={id} summary={label}>{section}</Details>)}
    </>}
    {sections.footer}
  </>;
}
