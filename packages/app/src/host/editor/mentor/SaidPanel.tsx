"use client";

// WEB-NF6-RUNDA (NF-6 MK-8): "Što je mentor rekao", the mentor's comment, the deadline of the revision and
// what is still open on the text, in one place of the Mentor card. The caller reads; `undefined` is still
// reading, `null` is a failed read (with "Pokušaj ponovno"), never "nothing said".
import { useEffect, useRef, useState } from "react";

import { Button } from "@ductura/ui";

import type { RevisionRequest } from "../../../../../../src/client/revision-requests";

import { mentorCardHr } from "./messages.hr";
import { saidView, type ReturnNotice } from "./round-feedback";

const t = mentorCardHr.said;

export type SaidRead = { readonly ret: ReturnNotice | null; readonly requests: readonly RevisionRequest[] };

export function SaidPanel({ read, now, onRetry, onShown }: {
  read: SaidRead | null | undefined; now: Date; onRetry?: () => void;
  /** MEN-R06: called with the revisions once they are on screen, so "student je vidio" can be recorded. */
  onShown?: (requests: readonly RevisionRequest[]) => void;
}) {
  // MEN-R06: only the open revisions the panel counts, and only while the panel is really on screen
  // (the right panel mounts every tab and hides the inactive ones, so mounted is not seen).
  const ref = useRef<HTMLElement>(null);
  const visible = useVisible(ref);
  const requests = read ? read.requests : null;
  const view0 = read ? saidView(read.ret, read.requests, now) : null;
  useEffect(() => {
    if (!visible || !requests || view0 === null) return;
    const open = requests.filter((r) => r.state === "open" || r.state === "reopened");
    if (open.length > 0) onShown?.(open);
  }, [visible, requests, view0 === null, onShown]);
  const view = read ? saidView(read.ret, read.requests, now) : null;
  return (
    <section ref={ref} aria-label={t.title} data-mentor-said="">
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

/** True while the element is displayed: not inside a `hidden` tab and (where the browser can tell) intersecting the page. */
function useVisible(ref: { readonly current: HTMLElement | null }): boolean {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") { setVisible(el.closest("[hidden]") === null); return; }
    const io = new IntersectionObserver((entries) => {
      const last = entries[entries.length - 1];
      setVisible(!!last && last.isIntersecting && el.closest("[hidden]") === null);
    });
    io.observe(el);
    return () => io.disconnect();
  }, [ref]);
  return visible;
}
