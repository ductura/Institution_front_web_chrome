"use client";

import { useEffect, useState } from "react";
import { Button, Notice } from "@ductura/ui";

import { orderVersions, versionText, type TimeMachinePort, type Version, type VersionText } from "./model";
import { timeMachineMessages as text } from "./messages.hr";

type Versions = readonly Version[] | "unavailable" | "signedOut" | null;
type Read = VersionText | "loading" | "failed" | "signedOut";
type Shown = { revision: number; read: Read } | null;

/**
 * "Povijest dokumenta" (PIL-D7-POVIJEST): the student's saved versions, newest first, and the text
 * of the one chosen. Only reads: there is no field, no restore and no way to write from here.
 */
export default function VersionHistory({ documentId, port }: { documentId: string; port: TimeMachinePort }) {
  const [versions, setVersions] = useState<Versions>(null);
  const [attempt, setAttempt] = useState(0);
  const [shown, setShown] = useState<Shown>(null);

  useEffect(() => {
    let active = true;
    setVersions(null);
    setShown(null);
    void port.versions(documentId)
      .then((read) => { if (active) setVersions(read.kind === "ready" ? orderVersions(read.versions) : read.kind); })
      .catch(() => { if (active) setVersions("unavailable"); });
    return () => { active = false; };
  }, [documentId, port, attempt]);

  const open = async (revision: number) => {
    setShown({ revision, read: "loading" });
    let next: Read;
    try {
      const read = await port.version(documentId, revision);
      next = read.kind === "ready" ? versionText(read.document) : read.kind === "signedOut" ? "signedOut" : "failed";
    } catch {
      next = "failed";
    }
    setShown((now) => (now?.revision === revision ? { revision, read: next } : now));
  };

  const list = Array.isArray(versions) ? (versions as readonly Version[]) : null;
  const label = (v: Version) => text.version(v.kind, v.revision, v.savedMinute);
  const chosen = list?.find((v) => v.revision === shown?.revision);

  return (
    <section aria-label={text.historyTitle} data-version-history>
      {versions === null ? <p role="status">{text.loading}</p>
        : versions === "signedOut" ? <p role="alert">{text.signedOut}</p>
        : versions === "unavailable" ? (
          <>
            <p role="alert">{text.unavailable}</p>
            <Button tone="quiet" onClick={() => setAttempt((n) => n + 1)}>{text.retry}</Button>
          </>
        ) : list!.length === 0 ? <p>{text.historyEmpty}</p> : (
          <>
            <p>{text.historyIntro}</p>
            <ul>
              {list!.map((v) => (
                <li key={v.revision}>
                  <Button tone="quiet" aria-pressed={shown?.revision === v.revision} onClick={() => void open(v.revision)}>{label(v)}</Button>
                </li>
              ))}
            </ul>
            <div aria-live="polite">
              {shown === null ? null
                : shown.read === "loading" ? <p role="status">{text.historyLoadingText}</p>
                : shown.read === "signedOut" ? <p role="alert">{text.signedOut}</p>
                : shown.read === "failed" ? <p role="alert">{text.historyTextFailed}</p>
                : shown.read.kind === "unreadable" ? <p role="alert">{text.historyUnreadable}</p>
                : (
                  <article aria-label={chosen ? text.historyShown(label(chosen)) : text.historyTitle} data-version-text={shown.revision}>
                    <Notice>{text.historyReadOnly}</Notice>
                    {chosen ? <p><strong>{text.historyShown(label(chosen))}</strong></p> : null}
                    {shown.read.blocks.length === 0 ? <p>{text.historyBlank}</p>
                      : shown.read.blocks.map((b, i) => (b.kind === "heading" ? <h4 key={i}>{b.text}</h4> : <p key={i}>{b.text}</p>))}
                  </article>
                )}
            </div>
          </>
        )}
    </section>
  );
}
