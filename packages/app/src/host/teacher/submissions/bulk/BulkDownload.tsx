"use client";

import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { Button } from "@ductura/ui";

import { BULK_FORMATS, type BulkCall, type BulkFormat, type BulkLink } from "./contract";
import { bulkText as t } from "./messages.hr";
import { mayFollow, msUntilExpiry, requestFailure, viewOf } from "./model";
import { bulkPort } from "./port";

const FORMAT_LABEL: Record<BulkFormat, string> = { pdf: t.formatPdf, docx: t.formatDocx };

/**
 * The button "Preuzmi sve predaje" of the submissions table (WEB-1902; P-D2; WEB-2004; PIL-D2-ZIP): the server
 * answers with a link that expires, the screen shows it as a link with the expiry the server states. There is no
 * background job to wait for. The ZIP is the browser's GET of that link; when the expiry passes the link gives way
 * to a calm note and a new request, and a click on a link that has just expired is never followed.
 */
export default function BulkDownload(
  { call, assignmentId, now = () => new Date(), onSignedOut }: { call: BulkCall; assignmentId: string; now?: () => Date; onSignedOut?: () => void },
) {
  const port = useMemo(() => bulkPort(call, () => onSignedOut?.()), [call, onSignedOut]);
  const [format, setFormat] = useState<BulkFormat>("pdf");
  const [state, setState] = useState<{ assignmentId: string; link: BulkLink; started: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ assignmentId: string; text: string } | null>(null);
  const [, setTick] = useState(0);
  const shown = useRef(assignmentId);
  const section = useRef<HTMLElement>(null);
  const linkRef = useRef<HTMLAnchorElement>(null);
  const againRef = useRef<HTMLButtonElement>(null);
  const focusNext = useRef(false);
  const current = state?.assignmentId === assignmentId ? state : null;
  const link = current?.link ?? null;
  shown.current = assignmentId;

  useEffect(() => {
    setBusy(false);
    setNote(null);
    setState(null);
  }, [assignmentId]);

  // One timer per link: at the server's expiry the screen renders again and shows the link as expired.
  useEffect(() => {
    if (link === null) return;
    const ms = msUntilExpiry(link, now());
    if (ms === 0) return;
    const timer = setTimeout(() => {
      // The link that held focus goes away; focus moves to the new request, not to the page.
      const active = document.activeElement;
      focusNext.current = active === null || active === document.body || section.current?.contains(active) === true;
      setTick((n) => n + 1);
    }, ms);
    return () => clearTimeout(timer);
  }, [link, now]);

  const view = link === null ? null : viewOf(link, now());

  // The control the teacher was on leaves the page: the link takes focus when it arrives, the new request when it expires.
  useEffect(() => {
    if (!focusNext.current) return;
    focusNext.current = false;
    (view?.kind === "ready" ? linkRef.current : againRef.current)?.focus();
  }, [view?.kind, link]);

  async function request() {
    if (busy) return;
    setBusy(true);
    setNote(null);
    const asked = assignmentId;
    const outcome = await port.requestLink(asked, format);
    setBusy(false);
    // An answer for an assignment the screen no longer shows is dropped, a link and a refusal alike.
    if (shown.current !== asked) return;
    if (outcome.kind === "poveznica") {
      focusNext.current = true;
      setState({ assignmentId: asked, link: outcome.link, started: false });
    } else if (outcome.kind !== "session-expired") setNote({ assignmentId: asked, text: requestFailure(outcome) });
  }

  function choose(value: BulkFormat) {
    setFormat(value);
    // A link is for one format: another format needs its own request.
    setState((cur) => (cur !== null && cur.link.format !== value ? null : cur));
  }

  function follow(event: MouseEvent<HTMLAnchorElement>) {
    if (link !== null && mayFollow(link, now())) {
      setState((cur) => (cur === null ? cur : { ...cur, started: true }));
      return;
    }
    event.preventDefault();
    focusNext.current = true;
    setTick((n) => n + 1);
  }

  const status = busy ? t.requesting
    : view?.kind === "ready" ? (current?.started === true ? t.started : t.ready)
      : view?.kind === "expired" ? t.expired : "";
  const shownNote = note?.assignmentId === assignmentId ? note.text : null;
  return (
    <section aria-labelledby="bulk-download-h" ref={section}>
      <h3 id="bulk-download-h">{t.title}</h3>
      <p>{t.idle}</p>
      <fieldset disabled={busy}>
        <legend>{t.formatLegend}</legend>
        {BULK_FORMATS.map((value) => (
          <label key={value}>
            <input type="radio" name="bulk-format" value={value} checked={format === value} onChange={() => choose(value)} /> {FORMAT_LABEL[value]}
          </label>
        ))}
      </fieldset>
      {/* One live region that stays in the page; only its text changes, so a screen reader hears each state. */}
      <p role="status">{status}</p>
      {view?.kind === "ready" ? (
        <>
          <a ref={linkRef} href={view.href} download onClick={follow}>{t.download} ({FORMAT_LABEL[link?.format ?? format]})</a>
          <p>{t.expiresAt} {view.until}.</p>
          {current?.started === true && <Button tone="quiet" ref={againRef} onClick={() => void request()} disabled={busy}>{t.requestAgain}</Button>}
        </>
      ) : view?.kind === "expired" ? (
        <Button ref={againRef} onClick={() => void request()} disabled={busy}>{t.requestAgain}</Button>
      ) : (
        <Button onClick={() => void request()} disabled={busy}>{t.action}</Button>
      )}
      {shownNote !== null && <p role="alert">{shownNote}</p>}
    </section>
  );
}
