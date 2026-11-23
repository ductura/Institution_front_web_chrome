"use client";

import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { Button } from "@ductura/ui";

import { BULK_FORMATS, type BulkCall, type BulkFormat, type BulkLink } from "./contract";
import { bulkText as t } from "./messages.hr";
import { mayFollow, msUntilExpiry, requestFailure, viewOf } from "./model";
import { bulkPort } from "./port";
import styles from "./BulkDownload.module.css";

const FORMAT_LABEL: Record<BulkFormat, string> = { pdf: t.formatPdf, docx: t.formatDocx };

/**
 * The button "Preuzmi sve predaje" of the submissions table (WEB-1902; P-D2; WEB-2004; PIL-D2-ZIP): the server
 * answers with a link that expires, the screen shows it as a link with the expiry the server states. There is no
 * background job to wait for. The ZIP is the browser's GET of that link; when the expiry passes the link gives way
 * to a calm note and a new request, and a click on a link that has just expired is never followed.
 * PIL-D2-ZIP-DORADA: a new format drops a ready link; the answer for an earlier assignment is ignored; focus moves
 * to the link or the button that replaces the focused element; one live status region only changes its text.
 */
export default function BulkDownload(
  { call, assignmentId, now = () => new Date(), onSignedOut }: { call: BulkCall; assignmentId: string; now?: () => Date; onSignedOut?: () => void },
) {
  const port = useMemo(() => bulkPort(call, () => onSignedOut?.()), [call, onSignedOut]);
  const [format, setFormat] = useState<BulkFormat>("pdf");
  const [state, setState] = useState<{ assignmentId: string; link: BulkLink; started: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [, setTick] = useState(0);
  // Each request and each change of assignment takes a new number; an answer for an older number is stale.
  const seq = useRef(0);
  const linkRef = useRef<HTMLAnchorElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const focusNext = useRef<"link" | "button" | null>(null);
  const current = state?.assignmentId === assignmentId ? state : null;
  const link = current?.link ?? null;

  useEffect(() => {
    seq.current += 1;
    setBusy(false);
    setNote(null);
    setState(null);
  }, [assignmentId]);

  // After a render that removed the focused element, focus goes to the element that took its place.
  useEffect(() => {
    const target = focusNext.current === "link" ? linkRef.current : focusNext.current === "button" ? buttonRef.current : null;
    if (target === null) return;
    focusNext.current = null;
    target.focus();
  });

  // One timer per link: at the server's expiry the screen renders again and shows the link as expired.
  useEffect(() => {
    if (link === null) return;
    const ms = msUntilExpiry(link, now());
    if (ms === 0) return;
    const timer = setTimeout(() => {
      if (linkRef.current !== null && document.activeElement === linkRef.current) focusNext.current = "button";
      setTick((n) => n + 1);
    }, ms);
    return () => clearTimeout(timer);
  }, [link, now]);

  async function request() {
    if (busy) return;
    const mine = ++seq.current;
    setBusy(true);
    setNote(null);
    const asked = assignmentId;
    const outcome = await port.requestLink(asked, format);
    if (seq.current !== mine) return;
    setBusy(false);
    if (outcome.kind === "poveznica") {
      focusNext.current = "link";
      setState({ assignmentId: asked, link: outcome.link, started: false });
      return;
    }
    focusNext.current = "button";
    if (outcome.kind !== "session-expired") setNote(requestFailure(outcome));
  }

  function choose(value: BulkFormat) {
    if (value === format) return;
    setFormat(value);
    // A ready link is for the format it was asked for; a new format asks again.
    setState(null);
    setNote(null);
  }

  function follow(event: MouseEvent<HTMLAnchorElement>) {
    if (link !== null && mayFollow(link, now())) {
      setState((cur) => (cur === null ? cur : { ...cur, started: true }));
      return;
    }
    event.preventDefault();
    focusNext.current = "button";
    setTick((n) => n + 1);
  }

  const view = link === null ? null : viewOf(link, now());
  const started = view?.kind === "ready" && current?.started === true;
  const status = busy ? t.requesting : view?.kind === "ready" ? (started ? t.started : t.ready) : view?.kind === "expired" ? t.expired : "";
  return (
    <section aria-labelledby="bulk-download-h">
      <h2 id="bulk-download-h" className={styles.title}>{t.title}</h2>
      <p>{t.idle}</p>
      <fieldset disabled={busy} className={styles.formats}>
        <legend>{t.formatLegend}</legend>
        {BULK_FORMATS.map((value) => (
          <label key={value} className={styles.format}>
            <input type="radio" name="bulk-format" value={value} checked={format === value} onChange={() => choose(value)} /> {FORMAT_LABEL[value]}
          </label>
        ))}
      </fieldset>
      <p role="status">{status}</p>
      {view?.kind === "ready" && (
        <>
          <a ref={linkRef} href={view.href} download onClick={follow}>{t.download}</a>
          <p>{t.expiresAt} {view.until}.</p>
        </>
      )}
      {view?.kind === "ready" ? (
        started && <Button ref={buttonRef} tone="quiet" onClick={() => void request()} disabled={busy}>{t.requestAgain}</Button>
      ) : (
        <Button ref={buttonRef} onClick={() => void request()} disabled={busy}>{view?.kind === "expired" ? t.requestAgain : t.action}</Button>
      )}
      <p role="alert">{note ?? ""}</p>
    </section>
  );
}
