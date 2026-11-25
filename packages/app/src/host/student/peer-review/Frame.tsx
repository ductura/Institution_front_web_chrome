"use client";

import type { ReactNode } from "react";
import { Button, Card, RouteLoading } from "@ductura/ui";

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
  if (read.kind === "notFound") return <Card level={2} title={title}><p role="alert">{t.gone}</p></Card>;
  if (read.kind === "unavailable") {
    return (
      <Card level={2} title={title}>
        <p role="alert">{t.unavailable}</p>
        <p><Button tone="quiet" onClick={retry}>{t.retry}</Button></p>
      </Card>
    );
  }
  return null;
}

/** A text of a student as paragraphs, one per line; always text, never markup. */
export function Lines({ text }: { text: string }) {
  return <>{text.split("\n").filter((line) => line.trim() !== "").map((line, i) => <p key={i}>{line}</p>)}</>;
}
