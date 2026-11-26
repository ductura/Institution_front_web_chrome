"use client";

import { useEffect, useMemo, useState } from "react";

import { createRhythmPort, type RhythmPort } from "../../../../client/input-rhythm";
import { createRecordedPort, TRANSFER_KINDS, type Answer, type ConversationsSummary, type RecordedPort, type Transfers } from "../../../../client/recorded-overview";
import { RhythmSetting } from "../../rhythm/RhythmSetting";
import { inputRhythmHr, whatIsRecordedHr as t } from "../../../../lib/i18n/messages.hr";
import styles from "./WhatIsRecorded.module.css";

type Props = {
  /** The work whose rhythm setting is shown; without it the setting is not available. */
  documentId?: string;
  /** The assignment of the work: the conversations with the assistant belong to it. */
  assignmentId?: string;
  /** Where the setting is read and the rhythm deleted; the server (createRhythmPort) by default, the fake in tests. */
  port?: RhythmPort;
  /** Where the read-only overview is read; the server (createRecordedPort) by default, a fake in tests. */
  recorded?: RecordedPort;
};

const DAY = new Intl.DateTimeFormat("hr-HR", { timeZone: "Europe/Zagreb", day: "numeric", month: "numeric", year: "numeric" });

/** "26. 11. 2026" from an ISO instant, or null when it is not a date. */
function dayOf(iso: string | null): string | null {
  if (iso === null) return null;
  const at = new Date(iso);
  return Number.isNaN(at.getTime()) ? null : DAY.format(at).replace(/\.$/, "");
}

type Shown<T> = Answer<T> | "loading" | "unknown";

/** One read of the overview; "loading" until the server answers, never an empty overview in its place. */
function useAnswer<T>(read: (() => Promise<Answer<T>>) | null): Shown<T> {
  const [answer, setAnswer] = useState<Answer<T> | "loading">("loading");
  useEffect(() => {
    if (read === null) return;
    let alive = true;
    setAnswer("loading");
    void read().then(
      (next) => { if (alive) setAnswer(next); },
      () => { if (alive) setAnswer({ kind: "unavailable" }); },
    );
    return () => { alive = false; };
  }, [read]);
  return read === null ? "unknown" : answer;
}

function Failure({ answer, testId }: { answer: { kind: "signedOut" | "unavailable" } | "loading"; testId: string }) {
  return <p data-testid={testId}>{answer === "loading" ? t.recorded.loading : answer.kind === "signedOut" ? t.recorded.signedOut : t.recorded.unavailable}</p>;
}

function Conversations({ answer }: { answer: Shown<ConversationsSummary> }) {
  if (answer === "unknown") return <p data-testid="recorded-conversations-unknown">{t.recorded.conversations.unknown}</p>;
  if (answer === "loading" || answer.kind !== "ready") return <Failure answer={answer} testId="recorded-conversations-state" />;
  const { conversations, requests, lastActivityAt } = answer.value;
  if (conversations === 0) return <p data-testid="recorded-conversations-none">{t.recorded.conversations.none}</p>;
  const last = dayOf(lastActivityAt);
  return <p data-testid="recorded-conversations">
    {t.recorded.conversations.count.replace("{conversations}", String(conversations)).replace("{requests}", String(requests))}
    {last === null ? "" : ` ${t.recorded.conversations.last.replace("{date}", last)}`}
  </p>;
}

function TransfersList({ answer }: { answer: Shown<Transfers> }) {
  if (answer === "unknown") return <Failure answer={{ kind: "unavailable" }} testId="recorded-transfers-state" />;
  if (answer === "loading" || answer.kind !== "ready") return <Failure answer={answer} testId="recorded-transfers-state" />;
  return <ul data-testid="recorded-transfers">
    {TRANSFER_KINDS.map((kind) => {
      const part = answer.value.find((p) => p.kind === kind);
      return <li key={kind}>{t.recorded.transfers[kind]}: {t.recorded.transfers.percent.replace("{percent}", String(Math.round(part?.percent ?? 0)))}</li>;
    })}
  </ul>;
}

/** Read-only: conversations, transfers and attachments of the work (F4-EDI-R06). Nothing here changes anything. */
function RecordedOverview({ documentId, assignmentId, port }: { documentId?: string; assignmentId?: string; port: RecordedPort }) {
  const readTransfers = useMemo(() => (documentId === undefined ? null : () => port.transfers(documentId)), [port, documentId]);
  const readConversations = useMemo(() => (assignmentId === undefined ? null : () => port.conversations(assignmentId)), [port, assignmentId]);
  const transfers = useAnswer(readTransfers);
  const conversations = useAnswer(readConversations);
  return (
    <section data-testid="recorded-overview" aria-label={t.recorded.heading}>
      <dl className={styles.list}>
        <div><dt>{t.recorded.conversations.heading}</dt><dd><Conversations answer={conversations} /></dd></div>
        <div><dt>{t.recorded.transfers.heading}</dt><dd><TransfersList answer={transfers} /></dd></div>
        {/* No route lists the attachments of a work (work.attachments.get reads one by id): said honestly, not guessed. */}
        <div><dt>{t.recorded.attachments.heading}</dt><dd><p data-testid="recorded-attachments">{t.recorded.attachments.unavailable}</p></dd></div>
      </dl>
    </section>
  );
}

export function WhatIsRecorded({ documentId, assignmentId, port, recorded }: Props) {
  const server = useMemo(() => port ?? createRhythmPort(), [port]);
  const overview = useMemo(() => recorded ?? createRecordedPort(), [recorded]);
  return (
    <div className={styles.root} data-testid="what-is-recorded">
      <dl className={styles.list}>
        <div><dt>{t.what.heading}</dt><dd>{t.what.text}</dd></div>
        <div><dt>{t.when.heading}</dt><dd>{t.when.text}</dd></div>
        <div>
          <dt>{t.rhythm.heading}</dt>
          <dd>{t.rhythm.text}</dd>
          <dd>{documentId === undefined
            ? <p data-testid="rhythm-setting-unknown">{inputRhythmHr.unknown}</p>
            : <RhythmSetting port={server} documentId={documentId} />}</dd>
        </div>
        <div><dt>{t.not.heading}</dt><dd>{t.not.text}</dd></div>
        <div><dt>{t.who.heading}</dt><dd>{t.who.text}</dd></div>
      </dl>
      <RecordedOverview documentId={documentId} assignmentId={assignmentId} port={overview} />
      <p className={styles.note}>{t.note}</p>
    </div>
  );
}
