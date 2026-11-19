"use client";

import { Button, Card, Checkbox, Steps, Tag } from "@ductura/ui";
import { useRouter } from "next/navigation";
import { useEffect, useId, useState } from "react";

import { countHr } from "../../lib/i18n/hr";
import { messagesHr } from "../../lib/i18n/messages.hr";

const t = messagesHr.declaration;
const s = messagesHr.summary;

/**
 * TODO(ugovor): the part of the process summary (ProcessSummaryV1, SRV-23)
 * this step shows. The student's read of the summary is not in the published
 * contract yet; on its release the page reads it through src/client and this
 * type gives way to the contract's.
 */
export type RecordedSummary = {
  readonly sessions: { readonly breakAboveMinutes: number; readonly count: number };
  readonly pastes: {
    readonly listedAboveCharacters: number;
    readonly listed: readonly unknown[];
    readonly smallerCount: number;
  };
  readonly gaps: { readonly items: readonly unknown[] };
  readonly recordState: "complete" | "has_gaps";
};

/** The variants of the "Zabilježeno u Ducturi" block: puno and prazno come from `ready`. */
export type RecordedRead =
  | { readonly kind: "ready"; readonly summary: RecordedSummary }
  | { readonly kind: "loading" }
  | { readonly kind: "error" };

/**
 * Where the flow keeps the confirmation: this tab only, never the server
 * (P-7), under this session and assignment. A sign-out leaves the tab's
 * storage, so the next person signed in here has another session and finds
 * nothing ticked. Without a known session nothing is kept.
 */
export function confirmationKey(session: string | null, assignmentId: string): string | null {
  return session === null ? null : `ductura.predaja.izjava.${session}.${assignmentId}`;
}

function isEmpty(summary: RecordedSummary): boolean {
  return summary.sessions.count === 0 && summary.pastes.listed.length === 0
    && summary.pastes.smallerCount === 0 && summary.gaps.items.length === 0;
}

/** Each number with the threshold that decides it (PRODUCT §5 rule 12); nothing summed. */
export function recordedRows(summary: RecordedSummary): readonly string[] {
  const minutes = s.units.minutesGenitive;
  const chars = s.units.charactersGenitive;
  const { sessions, pastes, gaps } = summary;
  return [
    `${s.sessions.count}: ${sessions.count} (${s.sessions.threshold} ${countHr(sessions.breakAboveMinutes, minutes.one, minutes.few, minutes.many)})`,
    `${t.pastesListed}: ${pastes.listed.length} (${s.pastes.listedThreshold} ${countHr(pastes.listedAboveCharacters, chars.one, chars.few, chars.many)})`,
    `${s.pastes.smaller}: ${pastes.smallerCount}`,
    `${s.gaps.heading}: ${gaps.items.length}`,
    `${s.recordState.label}: ${summary.recordState === "complete" ? s.recordState.complete : t.hasGaps}`,
  ];
}

export type DeclarationViewProps = {
  readonly recorded: RecordedRead;
  readonly confirmed: boolean;
  readonly onConfirm: (confirmed: boolean) => void;
  readonly onNext: () => void;
  readonly onBack: () => void;
  readonly onRetry: () => void;
};

/**
 * S: E-9, step 2 of the submission (WEB-24, C-3). What Ductura recorded and
 * what the student declares stand in separate blocks (D-40, D-44). Only the
 * unticked "Potvrđujem izjavu" holds the flow; a block that cannot load does
 * not, as a technical error never stops a submission (§5 rule 11).
 */
export function DeclarationView({ recorded, confirmed, onConfirm, onNext, onBack, onRetry }: DeclarationViewProps) {
  const hint = useId();
  return (
    <div className="page declaration">
      <Steps currentStep={2} />
      <h1>{t.title}</h1>
      <Card
        title={t.recorded}
        busy={recorded.kind === "loading"}
        error={recorded.kind === "error" ? t.recordedError : undefined}
      >
        {recorded.kind === "ready" && (
          <>
            <Tag>{t.recordedTag}</Tag>
            {isEmpty(recorded.summary) ? (
              <p>{t.recordedEmpty}</p>
            ) : (
              <ul>{recordedRows(recorded.summary).map((row) => <li key={row}>{row}</li>)}</ul>
            )}
            <p>{t.recordedNote}</p>
          </>
        )}
      </Card>
      {recorded.kind === "loading" && <p role="status">{t.recordedLoading}</p>}
      {recorded.kind === "error" && <Button tone="quiet" onClick={onRetry}>{t.retry}</Button>}
      <Card title={t.declared}>
        <Tag>{t.declaredTag}</Tag>
        <p>{recorded.kind === "ready" ? t.statement : t.statementWithoutRecord}</p>
        <Checkbox label={t.confirm} hint={t.keptHere} checked={confirmed}
          onChange={(event) => onConfirm(event.currentTarget.checked)} />
      </Card>
      <p>
        <Button disabled={!confirmed} aria-describedby={confirmed ? undefined : hint} onClick={onNext}>{t.next}</Button>
        <Button tone="quiet" onClick={onBack}>{t.back}</Button>
      </p>
      {!confirmed && <p id={hint}>{t.nextHint}</p>}
    </div>
  );
}

export type DeclarationProps = {
  readonly assignmentId: string;
  /** A digest of the session cookie from the server, never the cookie; null when there is none. */
  readonly session: string | null;
  readonly recorded: RecordedRead;
};

export function readConfirmed(key: string | null): boolean {
  if (key === null) return false;
  try {
    return window.sessionStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

export function writeConfirmed(key: string | null, confirmed: boolean): void {
  if (key === null) return;
  try {
    if (confirmed) window.sessionStorage.setItem(key, "1");
    else window.sessionStorage.removeItem(key);
  } catch {
    // Without storage the tick holds until the page is left.
  }
}

/** The step with its state: never ticked in advance, kept when the student comes back from step 3. */
export default function Declaration({ assignmentId, session, recorded }: DeclarationProps) {
  const router = useRouter();
  const key = confirmationKey(session, assignmentId);
  const [confirmed, setConfirmed] = useState(false);
  // Read after the first render, so the server's markup (unticked) matches.
  useEffect(() => setConfirmed(readConfirmed(key)), [key]);
  const base = `/rad/${encodeURIComponent(assignmentId)}`;
  return (
    <DeclarationView
      recorded={recorded}
      confirmed={confirmed}
      onConfirm={(next) => {
        setConfirmed(next);
        writeConfirmed(key, next);
      }}
      onNext={() => router.push(`${base}/predaja/pregled`)}
      onBack={() => router.push(base)}
      onRetry={() => router.refresh()}
    />
  );
}
