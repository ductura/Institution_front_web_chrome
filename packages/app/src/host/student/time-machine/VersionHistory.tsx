"use client";

import { useEffect, useState } from "react";
import { Button, Notice } from "@ductura/ui";

import { orderVersions, versionText, type TimeMachinePort, type Version, type VersionText } from "./model";
import { timeMachineMessages as text } from "./messages.hr";

type Versions = { readonly list: readonly Version[]; readonly more: boolean } | "unavailable" | "signedOut" | null;
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
      .then((read) => { if (active) setVersions(read.kind === "ready" ? { list: orderVersions(read.versions), more: read.more === true } : read.kind); })
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

  const list = versions !== null && typeof versions === "object" ? versions.list : null;
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
            {versions !== null && typeof versions === "object" && versions.more ? <p data-older-versions>{text.historyOlder}</p> : null}
            <ul>
              {list!.map((v) => (
                <li key={v.revision}>
                  <Button tone="quiet" aria-current={shown?.revision === v.revision ? "true" : undefined} onClick={() => void open(v.revision)}>{label(v)}</Button>
                </li>
              ))}
            </ul>
            {/* The one live region says only the state; the text itself is read in its own article. */}
            <p role="status" data-version-state>
              {shown === null ? null
                : shown.read === "loading" ? text.historyLoadingText
                : shown.read === "signedOut" ? text.signedOut
                : shown.read === "failed" ? text.historyTextFailed
                : shown.read.kind === "unreadable" ? text.historyUnreadable
                : chosen ? text.historyShown(label(chosen)) : null}
            </p>
            {shown !== null && typeof shown.read === "object" && shown.read.kind === "ready" ? (
              <article aria-label={chosen ? text.historyShown(label(chosen)) : text.historyTitle} data-version-text={shown.revision}>
                <Notice>{text.historyReadOnly}</Notice>
                {shown.read.blocks.length === 0 ? <p>{text.historyBlank}</p>
                  : shown.read.blocks.map((b, i) => {
                    // The version's own headings sit below this panel's: level 1 to 3 become h4 to h6.
                    const Heading = (`h${(b.level ?? 1) + 3}`) as "h4" | "h5" | "h6";
                    return b.kind === "heading" ? <Heading key={i}>{b.text}</Heading> : <p key={i}>{b.text}</p>;
                  })}
              </article>
            ) : null}
          </>
        )}
    </section>
  );
}
