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

export type LeftSections = Partial<Record<"requirements" | "figures" | "stash" | "progress" | "deadlines" | "thread", ReactNode>>;

type Outline = { headings: NumberedHeading[]; current: NumberedHeading | undefined; words?: ReadonlyMap<string, number> };

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
  const label = (heading: NumberedHeading) => {
    const id = heading.id;
    const words = id ? data.words?.get(id) : undefined;
    return <span>{headingLabel(heading)}{id && words !== undefined && <ChapterLength words={words} target={targets.get(id)} />}</span>;
  };
  const go = (heading: NumberedHeading) => {
    if (!editor || editor.isDestroyed) return;
    const pos = heading.id ? blockPosition(editor.state.doc, heading.id) : heading.pos;
    if (pos === null) return;
    editor.chain().setTextSelection(pos + 1).scrollIntoView().run();
    onJump();
    requestAnimationFrame(() => { if (!editor.isDestroyed) editor.view.focus(); });
  };
  const content = Object.entries(t.leftSections).map(([key, label]) => ({
    id: key, label, content: sections[key as keyof LeftSections] ?? <p className="rail-empty">{t.emptyGroup}</p>,
  }));
  const outline = data.headings.length ? <nav aria-label={messagesHr.outline.label}>
    <ol className="outline">
      {data.headings.map((heading) => <li key={headingKey(heading)} data-level={heading.level} className="outline__item">
        <Button tone="quiet" className="outline__link" aria-current={heading === data.current ? "location" : undefined}
          onClick={() => go(heading)}>{label(heading)}</Button>
      </li>)}
    </ol>
  </nav> : <p className="rail-empty">{w.structureEmpty}</p>;

  return <>
    <div className={styles.panelHeading}><span>{t.variants.left[layout]}</span>{settings}</div>
    {layout === "b" ? <PanelTabs label={w.structureLabel} tabs={[{ id: "structure", label: w.structure, content: outline }, ...content]} /> : <>
      {layout === "c" ? <ChapterCards outline={data} go={go} label={label} /> : outline}
      {content.map(({ id, label, content: section }) => <Details key={id} summary={label}>{section}</Details>)}
    </>}
  </>;
}
