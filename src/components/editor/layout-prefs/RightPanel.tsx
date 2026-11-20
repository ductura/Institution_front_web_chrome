"use client";

import { Button, Details, PanelTabs } from "@ductura/ui";
import { useEditorState } from "@tiptap/react";
import { type ReactNode } from "react";

import { currentHeading, numberedHeadings } from "@/editor";
import { editorPanelLayoutsHr as t, messagesHr } from "@/lib/i18n/messages.hr";

import { useLocalEditor } from "../LocalDocument";
import styles from "../SidePanels.module.css";
import type { PanelLayout } from "./preferences";

const groups = ["sources", "comments", "review", "work", "assistant"] as const;
const symbols = { sources: "▤", comments: "▱", review: "≡", work: "➤", assistant: "✧" };
export type PanelGroup = (typeof groups)[number];
export type RightSections = Partial<Record<PanelGroup, ReactNode>>;

function ChapterContext() {
  const editor = useLocalEditor();
  const chapter = useEditorState({ editor, selector: ({ editor: instance }) => {
    if (!instance || instance.isDestroyed) return null;
    const { doc, selection } = instance.state;
    const headings = numberedHeadings(doc).filter(({ level }) => level === 2);
    const index = currentHeading(headings, selection.from);
    const heading = headings[index];
    if (!heading) return null;
    const end = headings[index + 1]?.pos ?? doc.content.size;
    const lines: string[] = [];
    doc.forEach((node, offset) => {
      if (offset <= heading.pos || offset >= end || node.type.name !== "paragraph" || !node.textContent.trim()) return;
      lines.push(node.textContent.trim().split(/(?<=[.!?])\s/u, 1)[0]!);
    });
    return { title: `${heading.number}. ${heading.title || messagesHr.outline.untitledHeading}`, lines };
  } });

  return <>
    <div className={styles.chapterContext}>
      <span>{chapter ? t.writingIn : t.wholeWork}</span>
      <strong>{chapter?.title ?? t.noChapter}</strong>
    </div>
    {chapter !== null && chapter !== undefined && <Details summary={t.chapterOutline}>
      {chapter.lines.length ? <ul>{chapter.lines.map((line, index) => <li key={index}>{line}</li>)}</ul> : <p>{t.noParagraphs}</p>}
    </Details>}
  </>;
}

export function RightPanel({ layout, sections = {}, settings, selection, onSelect, drawer }: {
  layout: PanelLayout;
  sections?: RightSections;
  settings: ReactNode;
  selection: PanelGroup | null;
  onSelect: (group: PanelGroup | null) => void;
  drawer: boolean;
}) {
  const content = (group: PanelGroup) => sections[group] ?? <p className="rail-empty">{t.emptyGroup}</p>;
  const shown = selection ?? (drawer ? groups[0] : null);
  const view = (group: PanelGroup) => <div className={styles.rightContent}><h2>{t.groups[group]}</h2>{content(group)}</div>;
  return <div className={styles.rightLayout} data-layout={layout}>
    <div className={styles.rightSettings}>{settings}</div>
    {layout === "a" && <PanelTabs label={messagesHr.workspace.panelTabs}
      tabs={groups.map((id) => ({ id, label: t.groups[id], content: content(id) }))} />}
    {layout === "b" && <>
      <div className={`${styles.panelHeading} ${styles.contextHeading}`}>
        {selection ? <Button tone="quiet" onClick={() => onSelect(null)}>{t.backToContext}</Button> : <span>{t.variants.right.b}</span>}
      </div>
      {selection ? view(selection) : <div className={styles.rightContent}>
        <ChapterContext />
        <h2>{t.wholeWork}</h2>
        <div className={styles.workGroups}>
          {groups.map((group) => <Button key={group} tone="quiet" onClick={() => onSelect(group)}>{t.groups[group]}</Button>)}
        </div>
      </div>}
    </>}
    {layout === "c" && <>
      <div className={styles.iconStrip} role="group" aria-label={messagesHr.workspace.panelTabs}>
        {groups.map((group) => <Button key={group} tone="quiet" aria-pressed={shown === group}
          onClick={() => onSelect(!drawer && shown === group ? null : group)}>
          <span aria-hidden="true">{symbols[group]}</span>{t.groups[group]}
        </Button>)}
      </div>
      {shown && view(shown)}
    </>}
  </div>;
}
