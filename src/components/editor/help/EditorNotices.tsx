"use client";

import { Button } from "@ductura/ui";
import { MULTI_TAB_BLOCKED_MESSAGE } from "@/domain/sync/labels";
import type { ReactNode } from "react";

import { messagesHr } from "../../../lib/i18n/messages.hr";
import { editorNoticesHr as t } from "./notices.hr";
import styles from "./EditorNotices.module.css";

export type EditorNotice =
  | { kind: "blocked" }
  | { kind: "offline"; savingLocally: boolean; resumesSync?: boolean; waiting?: string | null }
  | { kind: "reconnected"; sending: string }
  | { kind: "outline"; resume: () => void }
  | { kind: "chapter"; title: string; showAll: () => void }
  | { kind: "note"; text: string; go: () => void; remove: () => void }
  | { kind: "dictation"; preview?: string; stop: () => void }
  | { kind: "submitted"; when?: string; receipt?: () => void }
  | { kind: "teacher" }
  | { kind: "round"; number: number; review: () => void };

function Action({ children, run }: { children: ReactNode; run: () => void }) {
  return <Button tone="quiet" className={styles.action} onClick={run}>{children}</Button>;
}

function contents(notice: EditorNotice) {
  switch (notice.kind) {
    case "blocked":
      return <span><strong>{MULTI_TAB_BLOCKED_MESSAGE}</strong> {messagesHr.editor.blockedHint}</span>;
    case "offline":
      return <span>{notice.savingLocally ? messagesHr.network.offlineSaving : messagesHr.network.offlineNotSaving}
        {notice.savingLocally && notice.resumesSync ? ` ${t.resumeSync}` : null}
        {notice.savingLocally && notice.waiting ? ` ${notice.waiting}` : null}</span>;
    case "reconnected":
      return <span><strong>{t.reconnected}</strong> {notice.sending}</span>;
    case "outline":
      return <><span>{t.outline}</span><Action run={notice.resume}>{t.resume}</Action></>;
    case "chapter":
      return <><span>{t.chapter.replace("{title}", () => notice.title)}</span><Action run={notice.showAll}>{t.wholeWork}</Action></>;
    case "note":
      return <><span><strong>{t.note}</strong> {notice.text}</span><div>
        <Action run={notice.go}>{t.go}</Action><Action run={notice.remove}>{t.remove}</Action>
      </div></>;
    case "dictation":
      return <><span><strong>{t.dictation}</strong>{" "}
        <span aria-hidden={notice.preview ? true : undefined}>{notice.preview || t.speak}</span>
      </span><Action run={notice.stop}>{t.stop}</Action></>;
    case "submitted":
      return <><span><strong>{t.submitted}</strong> {notice.when && `${notice.when} `}{t.locked}</span>
        {notice.receipt && <Action run={notice.receipt}>{t.receipt}</Action>}</>;
    case "teacher":
      return <span><strong>{t.teacher}</strong> {t.readOnly}</span>;
    case "round":
      return <><span><strong>{t.round.replace("{number}", String(notice.number))}</strong> {t.changed}</span>
        <Action run={notice.review}>{t.reviewRound}</Action></>;
  }
}

/** Place at the top of the paper, above the text. The host owns each condition and action. */
export function EditorNotices({ notices }: { notices: readonly EditorNotice[] }) {
  return <div role="status">{notices.map((notice) => (
    <div key={notice.kind} className={styles.notice}>{contents(notice)}</div>
  ))}</div>;
}
