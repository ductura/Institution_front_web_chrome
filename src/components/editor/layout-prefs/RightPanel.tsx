"use client";

import { Button, Details, PanelTabs, TabCount } from "@ductura/ui";
import { useEditorState } from "@tiptap/react";
import { type ReactNode, useState } from "react";

import { currentHeading, numberedHeadings } from "@/editor";
import { editorPanelLayoutsHr as t, messagesHr } from "@/lib/i18n/messages.hr";

import { useLocalEditor } from "../LocalDocument";
import styles from "../SidePanels.module.css";
import { useContextAlerts } from "./context-alerts";
import { OpenCommentsReport, openCommentsLabel } from "./panel-counts";
import { RIGHT_GROUPS, type PanelGroup, type PanelLayout } from "./preferences";

const icons = {
  sources: "M5 4h9a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3zM5 17a3 3 0 0 1 3-3h9",
  comments: "M4 5h16v11H10l-4 4v-4H4z",
  review: "M5 6h14M5 12h14M5 18h9",
  work: "M4 12l16-7-6 16-3-6z",
  assistant: "M12 4l1.8 5.2L19 11l-5.2 1.8L12 18l-1.8-5.2L5 11l5.2-1.8zM18.5 15.5v3M17 17h3",
};
export type { PanelGroup };
export type RightSections = Partial<Record<PanelGroup, ReactNode>>;

function ChapterContext({ openGroup }: { openGroup: (group: PanelGroup) => void }) {
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
  const alerts = useContextAlerts();

  return <>
    <div className={styles.chapterContext}>
      <span>{chapter ? t.writingIn : t.wholeWork}</span>
      <strong>{chapter?.title ?? t.noChapter}</strong>
    </div>
    {alerts.length > 0 && <div className={styles.contextAlerts} data-context-alerts="">
      {alerts.map((alert) => <button key={alert.key} type="button" onClick={() => openGroup(alert.group)}>
        <span>{alert.text}</span><i aria-hidden="true">›</i>
      </button>)}
    </div>}
    <h2>{t.commentsHere}</h2>
    <Button tone="quiet" onClick={() => openGroup("comments")}>{t.groups.comments}</Button>
    <h2>{t.sourcesHere}</h2>
    <Button tone="quiet" onClick={() => openGroup("sources")}>{t.allSources}</Button>
    <h2>{t.notesHere}</h2>
    <p className="rail-empty">{t.emptyGroup}</p>
    {chapter !== null && chapter !== undefined && <Details summary={t.chapterOutline}>
      {chapter.lines.length ? <ul>{chapter.lines.map((line, index) => <li key={index}>{line}</li>)}</ul> : <p>{t.noParagraphs}</p>}
    </Details>}
  </>;
}

export function RightPanel({ layout, sections = {}, settings, selection: asked, onSelect, drawer, groups = RIGHT_GROUPS, footer }: {
  layout: PanelLayout;
  /** ED-118: the groups shown, in the person's order (never empty). A hidden group asked for opens the first shown one. */
  groups?: readonly PanelGroup[];
  /** ED-110: the row at the foot of the panel (prototype `RP.HK.foot`), the same in every layout. */
  footer?: ReactNode;
  sections?: RightSections;
  settings: ReactNode;
  selection: PanelGroup | null;
  onSelect: (group: PanelGroup | null) => void;
  drawer: boolean;
}) {
  // Reported by the comments card below (useReportOpenComments).
  const [openComments, setOpenComments] = useState(0);
  const selection = asked === null || groups.includes(asked) ? asked : groups[0] ?? null;
  const count = (group: PanelGroup) =>
    group === "comments" && openComments > 0 ? { value: openComments, label: openCommentsLabel(openComments) } : undefined;
  const badge = (group: PanelGroup) => { const c = count(group); return c ? <TabCount {...c} /> : null; };
  const content = (group: PanelGroup) => sections[group] ?? <p className="rail-empty">{t.emptyGroup}</p>;
  const shown = selection ?? (drawer ? groups[0] : null);
  const label = (group: PanelGroup) => group === "work" ? t.workFull : t.groups[group];
  const view = (group: PanelGroup) => <div className={styles.rightContent}><h2>{label(group)}</h2>{content(group)}</div>;
  return <OpenCommentsReport.Provider value={setOpenComments}><div className={styles.rightLayout} data-layout={layout}>
    <div className={styles.rightSettings}>{settings}</div>
    {layout === "a" && <PanelTabs label={messagesHr.workspace.panelTabs} selected={selection ?? undefined} onChange={(id) => onSelect(id as PanelGroup)}
      tabs={groups.map((id) => ({ id, label: t.groups[id], content: content(id), count: count(id) }))} />}
    {layout === "b" && <>
      <div className={`${styles.panelHeading} ${styles.contextHeading}`}>
        {selection ? <Button tone="quiet" onClick={() => onSelect(null)}>{t.backToContext}</Button> : <span>{t.variants.right.b}</span>}
      </div>
      {selection ? view(selection) : <div className={styles.rightContent}>
        <ChapterContext openGroup={onSelect} />
        <h2>{t.wholeWork}</h2>
        <div className={styles.workGroups}>
          {groups.map((group) => <Button key={group} tone="quiet" onClick={() => onSelect(group)}>{label(group)}{badge(group)}</Button>)}
        </div>
      </div>}
    </>}
    {layout === "c" && <>
      <div className={styles.iconStrip} role="group" aria-label={messagesHr.workspace.panelTabs}>
        {groups.map((group) => <Button key={group} tone="quiet" aria-pressed={shown === group}
          onClick={() => onSelect(!drawer && shown === group ? null : group)}>
          <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d={icons[group]} /></svg>
          <span>{t.groups[group]}{badge(group)}</span>
        </Button>)}
      </div>
      {shown && view(shown)}
    </>}
    {footer ? <div className={styles.rightFooter}>{footer}</div> : null}
  </div></OpenCommentsReport.Provider>;
}
