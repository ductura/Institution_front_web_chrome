"use client";

// WEB-NF6-RUNDA (NF-6 MK-8): "Pregled runde" on N-16, one card per started mentored work: what is new since
// the last review, the mentor's requests on the text and the revision request with its mandatory deadline
// (RevisionSection of N-06, the same dialog and banners). Each card reads on its own; a failed read never
// hides the page.
import { Button } from "@ductura/ui";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

import { watchSessionEnd } from "../../../../../../src/client/session-end";
import { browserMarkStore, currentSession } from "../../../../../../src/client/session-marks";
import type { RevisionListOutcome } from "../../../../../../src/client/revision-requests";
import type { ChangesPort, ChangesRead } from "../changes-since-review/model";
import { changesPort } from "../changes-since-review/port";
import { RevisionSection } from "../revision";
import { revisionPort, type RevisionPort } from "../revision/port";
import { roundText as t } from "./messages.hr";
import { newsLine, requestsLine, seenLine, type SeenItem } from "./round-model";
import { readSeen, type SeenRead } from "./seen-port";

type Read = { news: ChangesRead; requests: RevisionListOutcome; seen: readonly SeenItem[] | null } | null;

export type RoundWork = { readonly documentId: string; readonly name: string; readonly href: string | null };

export function RoundReview({ work, changes = changesPort, revision = revisionPort, seen = readSeen }: {
  work: RoundWork; changes?: ChangesPort; revision?: RevisionPort; seen?: SeenRead;
}) {
  const watch = useRef<ReturnType<typeof watchSessionEnd> | null>(null);
  useLayoutEffect(() => {
    const listener = watchSessionEnd(currentSession(browserMarkStore()), () => undefined);
    watch.current = listener;
    return () => { watch.current = null; listener.close(); };
  }, []);
  const current = useCallback(() => watch.current?.ended() === false, []);
  const [read, setRead] = useState<Read>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let live = true;
    setRead(null);
    void Promise.all([
      changes.read(work.documentId).catch((): ChangesRead => ({ kind: "unavailable" })),
      revision.list(work.documentId, current).catch((): RevisionListOutcome => ({ kind: "unavailable" })),
      seen(work.documentId).catch(() => null),
    ]).then(([news, requests, items]) => { if (live) setRead({ news, requests, seen: items }); });
    return () => { live = false; };
  }, [work.documentId, changes, revision, seen, current, attempt]);

  const failed = read !== null && (read.news.kind !== "ready" || read.requests.kind !== "ok");
  return (
    <section className="card" aria-label={t.title(work.name)} data-round-review="">
      <h2>{t.title(work.name)}</h2>
      {read === null ? <p role="status">{t.loading}</p> : (
        <>
          <h3>{t.newsTitle}</h3>
          <p role={read.news.kind === "ready" ? undefined : "alert"}>{newsLine(read.news)}</p>
          <h3>{t.requestsTitle}</h3>
          <p role={read.requests.kind === "ok" ? undefined : "alert"}>{requestsLine(read.requests)}</p>
          {seenLine(read.requests, read.seen) !== null && <p>{seenLine(read.requests, read.seen)}</p>}
          <p className="note">{t.seenReturnUnknown}</p>
          {failed && <Button tone="quiet" size="dense" onClick={() => setAttempt((n) => n + 1)}>{t.retry}</Button>}
        </>
      )}
      <RevisionSection documentId={work.documentId} current={current} port={revision}>
        {(rev) => <>{rev.banner}{rev.action}{rev.dialog}</>}
      </RevisionSection>
      {work.href !== null && <a className="rowlink" href={work.href}>{t.openWork}</a>}
    </section>
  );
}
