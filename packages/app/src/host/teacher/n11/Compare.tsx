"use client";

import { useEffect, useState } from "react";
import { Button, DiffView } from "@ductura/ui";

import { goToSignIn } from "../../../../../../src/client/api";
import {
  countWords, currentLine, defaultFrom, diffRows, hasChanges, loadComparison, loadVersions, olderChoices, optionLabel, submittedVersions,
  type N11Compare, type N11Port, type N11Version, type N11Versions,
} from "./model";
import { n11Messages as text } from "./messages.hr";
import { Kv, WorkPage, WorkPanel, workPageStyles as styles } from "../n07/WorkPage";

const Lines = ({ message }: { message: string }) => (
  <><p className="note" role="status">{message}</p><div className="skel w80" /><div className="skel w60" /><div className="skel w40" /></>
);

const wrap = { whiteSpace: "pre-wrap", overflowWrap: "anywhere" } as const;

function Failure({ message, retry }: { message: string; retry: () => void }) {
  return (
    <>
      <p className="note" role="alert">{message}</p>
      <div className={styles.acts}><Button tone="secondary" onClick={retry}>{text.retry}</Button></div>
    </>
  );
}

function Result({ port, documentId, from, to, signInHref }: { port: N11Port; documentId: string; from: number; to: number; signInHref: string }) {
  const [read, setRead] = useState<N11Compare | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let live = true;
    setRead(null);
    void loadComparison(port, documentId, from, to).then((next) => {
      if (!live) return;
      if (next.kind === "signedOut") goToSignIn(signInHref);
      setRead(next);
    });
    return () => { live = false; };
  }, [port, documentId, from, to, attempt, signInHref]);

  if (read === null) return <Lines message={text.loadingComparison} />;
  if (read.kind === "signedOut") return <p role="status">{text.loadingComparison}</p>;
  if (read.kind !== "ready") {
    return <Failure message={read.kind === "notFound" ? text.notFound : text.compareError} retry={() => setAttempt((n) => n + 1)} />;
  }
  const { added, removed } = countWords(read.blocks);
  return (
    <>
      <Kv label={text.addedLabel}>{text.words(added)}</Kv>
      <Kv label={text.removedLabel}>{text.words(removed)}</Kv>
      <p className="meta">{text.wordsNote}</p>
      {!hasChanges(read.blocks) && <p className="note" role="status">{text.noChanges}</p>}
      <div className={`sheet ${styles.paper} ${styles.cmp}`}>
        {diffRows(read.blocks).map((row, index) => row.change === "unchanged"
          ? <p key={index} style={wrap}>{row.text}</p>
          : <DiffView key={index} parts={row.change === "changed" ? row.parts : [{ kind: row.change, text: row.text }]} />)}
      </div>
    </>
  );
}

function Picker({ port, documentId, submitted, replayHref, signInHref }: {
  port: N11Port; documentId: string; submitted: readonly N11Version[]; replayHref: string; signInHref: string;
}) {
  const [from, setFrom] = useState(defaultFrom(submitted));
  const newest = submitted[0];
  if (newest === undefined || from === null) {
    return <><p className="note" role="status">{text.empty}</p><a href={replayHref}>{text.emptyAction}</a></>;
  }
  return (
    <>
      <p><b>{currentLine(newest)}</b></p>
      <div className="field" style={{ maxWidth: 460 }}>
        <label htmlFor="f-cmp">{text.selectLabel}</label>
        <select className="input" id="f-cmp" aria-describedby="f-cmp-hint" value={from} onChange={(e) => setFrom(Number(e.currentTarget.value))}>
          {olderChoices(submitted).map((v) => <option key={v.revision} value={v.revision}>{optionLabel(v)}</option>)}
        </select>
        <span className="meta" id="f-cmp-hint">{text.selectHint}</span>
      </div>
      <Result key={`${from}:${newest.revision}`} port={port} documentId={documentId} from={from} to={newest.revision} signInHref={signInHref} />
    </>
  );
}

/**
 * N-11 "Usporedba verzija" (WEB-2160): the newest submitted version against one chosen older submitted version,
 * the previous one by default. Counts in words, no colour, no threshold. A failed read says so with a button.
 */
export default function N11Compare({ port, documentId, replayHref, signInHref, workHref = signInHref }: { port: N11Port; documentId: string; replayHref: string; signInHref: string; workHref?: string }) {
  const [read, setRead] = useState<N11Versions | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let live = true;
    setRead(null);
    void loadVersions(port, documentId).then((next) => {
      if (!live) return;
      if (next.kind === "signedOut") goToSignIn(signInHref);
      setRead(next);
    });
    return () => { live = false; };
  }, [port, documentId, attempt, signInHref]);

  const pending = read === null || read.kind === "signedOut";
  return (
    <WorkPage back={workHref} backLabel={text.backToWork}>
      <WorkPanel id={read?.kind === "ready" && submittedVersions(read.versions).length > 1 ? "cp-h" : "pg-h"} title={text.title} busy={pending}>
        {pending && <Lines message={text.loadingVersions} />}
        {read?.kind === "unavailable" && <Failure message={text.versionsError} retry={() => setAttempt((n) => n + 1)} />}
        {read?.kind === "ready" && (
          <Picker key={documentId} port={port} documentId={documentId} submitted={submittedVersions(read.versions)} replayHref={replayHref} signInHref={signInHref} />
        )}
      </WorkPanel>
    </WorkPage>
  );
}
