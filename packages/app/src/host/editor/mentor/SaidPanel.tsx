"use client";

// WEB-NF6-RUNDA (NF-6 MK-8): "Što je mentor rekao", the mentor's comment, the deadline of the revision and
// what is still open on the text, in one place of the Mentor card. The caller reads; `undefined` is still
// reading, `null` is a failed read (with "Pokušaj ponovno"), never "nothing said".
import { Button } from "@ductura/ui";

import type { RevisionRequest } from "../../../../../../src/client/revision-requests";

import { mentorCardHr } from "./messages.hr";
import { saidView, type ReturnNotice } from "./round-feedback";

const t = mentorCardHr.said;

export type SaidRead = { readonly ret: ReturnNotice | null; readonly requests: readonly RevisionRequest[] };

export function SaidPanel({ read, now, onRetry }: { read: SaidRead | null | undefined; now: Date; onRetry?: () => void }) {
  const view = read ? saidView(read.ret, read.requests, now) : null;
  return (
    <section aria-label={t.title} data-mentor-said="">
      <h4>{t.title}</h4>
      {read === undefined ? <p role="status">{t.loading}</p> : read === null ? (
        <>
          <p role="alert">{t.unavailable}</p>
          {onRetry && <Button size="dense" tone="quiet" onClick={onRetry}>{t.retry}</Button>}
        </>
      ) : view === null ? <p>{t.empty}</p> : (
        <>
          {view.returned !== null && <p>{view.returned}</p>}
          {view.comment !== null && <blockquote>{view.comment}</blockquote>}
          {view.due !== null && <p>{view.due}</p>}
          <p>{view.open}</p>
          <p>{t.how}</p>
        </>
      )}
    </section>
  );
}
