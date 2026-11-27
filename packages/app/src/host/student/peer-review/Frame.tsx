"use client";

import type { ReactNode } from "react";
import { Card, RouteLoading } from "@ductura/ui";

import { messagesHr as shell } from "../../../../../../locales/hr.ts";
import { appHref } from "../../../../../../src/components/shell/nav";
import { useHost } from "../../context";
import { DeniedState, LoadAlert } from "../../states/States";

import { peerReviewText as t } from "./messages.hr";
import type { Read } from "./read";

/** The marks every peer-review screen carries: the work is anonymous and the review does not enter the grade. */
export function Marks({ anonymous = true }: { anonymous?: boolean }) {
  return (
    <p role="note" data-testid="peer-review-marks">
      {anonymous && <><strong>{t.anonymousWork}.</strong> {t.anonymousWorkNote}{" "}</>}
      <strong>{t.notGraded}.</strong>
    </p>
  );
}

/**
 * The three states of a read that are not an answer: still loading, gone and unavailable. A refusal is never
 * shown as "nothing to show". Returns null when the read is an answer (the caller draws it).
 */
export function notAnswer<T>(read: Read<T> | null, title: string, retry: () => void): ReactNode | null {
  if (read === null || read.kind === "signedOut") return <RouteLoading label={t.loading} />;
  if (read.kind === "notFound") return <Card level={2} title={title}><LoadAlert body={t.gone} /></Card>;
  if (read.kind === "unavailable") {
    return <Card level={2} title={title}><LoadAlert body={t.unavailable} retry={{ label: t.retry, onRetry: retry }} /></Card>;
  }
  return null;
}

/** 403: the heading and the way back to the student's own space, instead of the page (V19, A3). */
export function Denied() {
  const { base } = useHost();
  return <DeniedState title={shell.access.deniedTitle} backLabel={shell.access.backToOwn} backHref={appHref(base, "/")} />;
}

/** A text of a student as paragraphs, one per line; always text, never markup. */
export function Lines({ text }: { text: string }) {
  return <>{text.split("\n").filter((line) => line.trim() !== "").map((line, i) => <p key={i}>{line}</p>)}</>;
}
