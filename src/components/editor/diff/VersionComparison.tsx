"use client";

import { Button, Checkbox, Select } from "@ductura/ui";
import { useEffect, useState } from "react";

import { ComparisonResult } from "./ComparisonResult";
import { readComparison, readSubmittedVersions, type Comparison, type ComparisonApi, type Read } from "./comparison-read";
import { comparisonHr as t } from "./messages.hr";

export type VersionComparisonProps = { client: ComparisonApi; documentId: string; replayHref: string };
type Mode = "page" | "submissions" | "round";

function ReadFailure({ message, retry }: { message: string; retry: () => void }) {
  return <div><p role="alert">{message}</p><Button tone="quiet" onClick={retry}>{t.retry}</Button></div>;
}

function SelectedComparison({ client, documentId, from, to, onlyChanges }: Pick<VersionComparisonProps, "client" | "documentId"> & {
  from: number; to: number; onlyChanges: boolean;
}) {
  const [read, setRead] = useState<Read<Comparison>>();
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let current = true;
    void readComparison(client, documentId, from, to).then((result) => { if (current) setRead(result); });
    return () => { current = false; };
  }, [client, documentId, from, to, attempt]);

  if (!read) return <p role="status">{t.loadingComparison}</p>;
  if (read.kind !== "ready") return <ReadFailure message={read.kind === "not-found" ? t.notFound : t.compareError}
    retry={() => { setRead(undefined); setAttempt((n) => n + 1); }} />;
  return <ComparisonResult comparison={read.value} onlyChanges={onlyChanges} />;
}

type Versions = Extract<Awaited<ReturnType<typeof readSubmittedVersions>>, { kind: "ready" }>["value"];

function VersionPicker({ client, documentId, versions, mode }: Pick<VersionComparisonProps, "client" | "documentId"> & {
  versions: Versions; mode: Mode;
}) {
  const [newest, previous] = versions;
  const [from, setFrom] = useState(previous?.revision ?? 0);
  const [to, setTo] = useState(newest?.revision ?? 0);
  const [onlyChanges, setOnlyChanges] = useState(mode !== "page");
  const options = versions.map(({ revision, savedMinute }) => ({ value: String(revision), label: t.version(revision, savedMinute) }));
  return (
    <>
      {mode === "submissions" && <div role="group" aria-label={t.timeline}>
        {options.map(({ value, label }) => <Button key={value} tone="quiet" aria-pressed={Number(value) === from}
          onClick={() => setFrom(Number(value))}>{label}</Button>)}
      </div>}
      {mode !== "round" && <>
        <Select label={t.from} options={options} value={from} onChange={(event) => setFrom(Number(event.currentTarget.value))} />
        <Select label={t.to} options={options} value={to} onChange={(event) => setTo(Number(event.currentTarget.value))} />
      </>}
      <Checkbox label={t.onlyChanges} checked={onlyChanges} onChange={(event) => setOnlyChanges(event.currentTarget.checked)} />
      {from === to ? <p role="status">{t.samePoint}</p> : <SelectedComparison key={`${from}:${to}`} client={client}
        documentId={documentId} from={from} to={to} onlyChanges={onlyChanges} />}
    </>
  );
}

function VersionsRead({ client, documentId, replayHref, mode }: VersionComparisonProps & { mode: Mode }) {
  const [read, setRead] = useState<Read<Versions>>();
  const [attempt, setAttempt] = useState(0);
  const limit = mode === "page" ? Infinity : 8;
  useEffect(() => {
    const controller = new AbortController();
    void readSubmittedVersions(client, documentId, controller.signal, limit).then((result) => {
      if (!controller.signal.aborted) setRead(result);
    });
    return () => controller.abort();
  }, [client, documentId, attempt, limit]);

  if (!read) return <p role="status">{t.loadingVersions}</p>;
  if (read.kind !== "ready") return <ReadFailure message={read.kind === "not-found" ? t.notFound : t.versionsError}
    retry={() => { setRead(undefined); setAttempt((n) => n + 1); }} />;
  if (read.value.length < 2) return <><p role="status">{t.empty}</p><a href={replayHref}>{t.replay}</a></>;
  return <VersionPicker key={mode} client={client} documentId={documentId} versions={read.value} mode={mode} />;
}

export function VersionComparison({ mode = "page", ...props }: VersionComparisonProps & { mode?: Mode }) {
  return <VersionsRead key={props.documentId} {...props} mode={mode} />;
}
