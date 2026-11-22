"use client";

import { useEffect, useState } from "react";
import { DiffView, Skeleton } from "@ductura/ui";

import { goToSignIn } from "../../../../../../src/client/api";
import {
  countWords, currentLine, defaultFrom, hasChanges, loadComparison, loadVersions, olderChoices, optionLabel, submittedVersions,
  type N11Compare, type N11Port, type N11Version, type N11Versions,
} from "./model";
import { n11Messages as text } from "./messages.hr";

const wrap = { whiteSpace: "pre-wrap", overflowWrap: "anywhere" } as const;

function Failure({ message, retry }: { message: string; retry: () => void }) {
  return (
    <div>
      <p role="alert">{message}</p>
      <button type="button" className="btn" onClick={retry}>{text.retry}</button>
    </div>
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

  if (read === null) return <Skeleton label={text.loadingComparison} />;
  if (read.kind === "signedOut") return <p role="status">{text.loadingComparison}</p>;
  if (read.kind !== "ready") {
    return <Failure message={read.kind === "notFound" ? text.notFound : text.compareError} retry={() => setAttempt((n) => n + 1)} />;
  }
  const { added, removed } = countWords(read.blocks);
  return (
    <>
      <div className="sb-kv"><span>{text.addedLabel}</span><b>{text.words(added)}</b></div>
      <div className="sb-kv"><span>{text.removedLabel}</span><b>{text.words(removed)}</b></div>
      <p className="meta">{text.wordsNote}</p>
      {!hasChanges(read.blocks) && <p role="status">{text.noChanges}</p>}
      {read.blocks.map(({ change, text: t }, index) => change === "unchanged"
        ? <p key={index} style={wrap}>{t}</p>
        : <DiffView key={index} parts={[{ kind: change, text: t }]} />)}
    </>
  );
}

function Picker({ port, documentId, submitted, replayHref, signInHref }: {
  port: N11Port; documentId: string; submitted: readonly N11Version[]; replayHref: string; signInHref: string;
}) {
  const [from, setFrom] = useState(defaultFrom(submitted));
  const newest = submitted[0];
  if (newest === undefined || from === null) {
    return <><p role="status">{text.empty}</p><p><a href={replayHref}>{text.emptyAction}</a></p></>;
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
export default function N11Compare({ port, documentId, replayHref, signInHref }: { port: N11Port; documentId: string; replayHref: string; signInHref: string }) {
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

  return (
    <div className="page">
      <h1>{text.title}</h1>
      {read === null && <Skeleton label={text.loadingVersions} />}
      {read?.kind === "signedOut" && <p role="status">{text.loadingVersions}</p>}
      {read?.kind === "unavailable" && <Failure message={text.versionsError} retry={() => setAttempt((n) => n + 1)} />}
      {read?.kind === "ready" && (
        <Picker key={documentId} port={port} documentId={documentId} submitted={submittedVersions(read.versions)} replayHref={replayHref} signInHref={signInHref} />
      )}
    </div>
  );
}
