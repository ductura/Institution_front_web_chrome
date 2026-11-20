"use client";

import { Button, Details, PanelTabs } from "@ductura/ui";
import { useEditorState } from "@tiptap/react";
import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

import { blockPosition, currentHeading, numberedHeadings, type NumberedHeading } from "@/editor";
import { editorPanelLayoutsHr as t, messagesHr } from "@/lib/i18n/messages.hr";

import HeadingOutline from "../HeadingOutline";
import { useLocalEditor } from "../LocalDocument";
import styles from "../SidePanels.module.css";
import type { PanelLayout } from "./preferences";

const w = messagesHr.workspace;
const headingKey = (heading: NumberedHeading) => heading.id ?? `pos-${heading.pos}`;
const headingLabel = (heading: NumberedHeading) => `${heading.number}. ${heading.title || messagesHr.outline.untitledHeading}`;

export type LeftSections = Partial<Record<"requirements" | "figures" | "stash" | "progress" | "deadlines" | "thread", ReactNode>>;

function ChapterCards({ onJump }: { onJump: () => void }) {
  const editor = useLocalEditor();
  const state = useEditorState({ editor, selector: ({ editor: instance }) => {
    if (!instance || instance.isDestroyed) return null;
    const headings = numberedHeadings(instance.state.doc).filter(({ level }) => level !== 1);
    return { headings, current: currentHeading(headings, instance.state.selection.from) };
  } });
  const [open, setOpen] = useState<string | null>(null);
  const returnTo = useRef<string | null>(null);
  const back = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const headings = state?.headings ?? [];
  const chapterIndex = headings.findIndex((heading) => headingKey(heading) === open);
  const chapter = headings[chapterIndex];
  const firstChapter = headings.findIndex(({ level }) => level === 2);
  const active = headings.slice(0, (state?.current ?? -1) + 1).findLast(({ level }) => level === 2)
    ?? headings[state?.current ?? -1];

  useLayoutEffect(() => {
    if (open !== null) back.current?.focus();
    else if (returnTo.current !== null) {
      Array.from(list.current?.querySelectorAll("button") ?? [])
        .find((button) => button.dataset.chapter === returnTo.current)?.focus();
      returnTo.current = null;
    }
  }, [open]);

  const go = (heading: NumberedHeading) => {
    if (!editor || editor.isDestroyed) return;
    const pos = heading.id ? blockPosition(editor.state.doc, heading.id) : heading.pos;
    if (pos === null) return;
    editor.chain().setTextSelection(pos + 1).scrollIntoView().run();
    onJump();
    requestAnimationFrame(() => { if (!editor.isDestroyed) editor.view.focus(); });
  };

  if (chapter) {
    const next = headings.findIndex((heading, index) => index > chapterIndex && heading.level <= chapter.level);
    const children = headings.slice(chapterIndex + 1, next === -1 ? undefined : next);
    return <div className={styles.chapterCards}>
      <Button ref={back} tone="quiet" onClick={() => setOpen(null)}>{t.allChapters}</Button>
      <Button tone="quiet" onClick={() => go(chapter)}>{headingLabel(chapter)}</Button>
      <h2>{t.subchapters}</h2>
      {children.map((heading) => <Button key={headingKey(heading)} tone="quiet" onClick={() => go(heading)}>
        {headingLabel(heading)}
      </Button>)}
      {children.length === 0 && <p>{t.noSubchapters}</p>}
    </div>;
  }

  return <div ref={list} className={styles.chapterCards}>
    {headings.filter((heading, index) => heading.level === 2 || firstChapter === -1 || index < firstChapter)
      .map((heading) => <Button key={headingKey(heading)} tone="quiet" data-chapter={headingKey(heading)}
        aria-current={heading === active ? "location" : undefined}
        onClick={() => { returnTo.current = headingKey(heading); setOpen(headingKey(heading)); }}>
        {headingLabel(heading)} <span aria-hidden="true">›</span>
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
  const content = Object.entries(t.leftSections).flatMap(([key, label]) => {
    const section = sections[key as keyof LeftSections];
    return section == null ? [] : [{ id: key, label, content: section }];
  });
  const outline = <div onClick={(event) => {
    if (!(event.target instanceof Element) || !event.target.closest(".outline__link")) return;
    onJump();
    requestAnimationFrame(() => { if (editor && !editor.isDestroyed) editor.view.focus(); });
  }}><HeadingOutline /></div>;

  return <>
    <div className={styles.panelHeading}><span>{t.variants.left[layout]}</span>{settings}</div>
    {layout === "b" ? <PanelTabs label={w.structureLabel} tabs={[{ id: "structure", label: w.structure, content: outline }, ...content]} /> : <>
      {layout === "c" ? <ChapterCards onJump={onJump} /> : outline}
      {content.map(({ id, label, content: section }) => <Details key={id} summary={label}>{section}</Details>)}
    </>}
  </>;
}
