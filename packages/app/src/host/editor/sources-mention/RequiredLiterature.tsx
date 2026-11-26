"use client";

import { Button } from "@ductura/ui";
import { useCallback, useEffect, useState } from "react";

import { sourcesMentionHr as t } from "./messages.hr";
import { liveRequiredLiterature, type LiteratureRead } from "./required-literature";

export function RequiredLiteratureView({ read, onRetry }: { read: LiteratureRead; onRetry: () => void }) {
  return <section aria-label={t.requiredHeading} data-required-literature>
    <h3>{t.requiredHeading}</h3>
    {read.kind === "loading" ? <p role="status">{t.requiredLoading}</p>
      : read.kind === "unavailable" ? <div role="alert">
        <p>{t.requiredUnavailable}</p>
        <Button tone="quiet" onClick={onRetry}>{t.requiredRetry}</Button>
      </div>
      : read.sources.length === 0 ? <p>{t.requiredNone}</p>
      : <ul>{read.sources.map((s) => <li key={s.id}>{s.label}</li>)}</ul>}
  </section>;
}

export function RequiredLiterature({ courseId, read = liveRequiredLiterature }: {
  courseId: string;
  read?: (courseId: string) => Promise<LiteratureRead>;
}) {
  const [state, setState] = useState<LiteratureRead>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let live = true;
    setState({ kind: "loading" });
    void read(courseId).then((next) => { if (live) setState(next); });
    return () => { live = false; };
  }, [courseId, read, attempt]);
  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  return <RequiredLiteratureView read={state} onRetry={retry} />;
}
