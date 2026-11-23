"use client";

import { useEffect, useMemo, useState, type MouseEvent } from "react";
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
  const [note, setNote] = useState<string | null>(null);
  const [, setTick] = useState(0);
  const current = state?.assignmentId === assignmentId ? state : null;
  const link = current?.link ?? null;

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
    const timer = setTimeout(() => setTick((n) => n + 1), ms);
    return () => clearTimeout(timer);
  }, [link, now]);

  async function request() {
    if (busy) return;
    setBusy(true);
    setNote(null);
    const asked = assignmentId;
    const outcome = await port.requestLink(asked, format);
    setBusy(false);
    if (outcome.kind === "poveznica") {
      setState((cur) => (cur === null || cur.assignmentId === asked ? { assignmentId: asked, link: outcome.link, started: false } : cur));
    } else if (outcome.kind !== "session-expired") setNote(requestFailure(outcome));
  }

  function follow(event: MouseEvent<HTMLAnchorElement>) {
    if (link !== null && mayFollow(link, now())) {
      setState((cur) => (cur === null ? cur : { ...cur, started: true }));
      return;
    }
    event.preventDefault();
    setTick((n) => n + 1);
  }

  const view = link === null ? null : viewOf(link, now());
  const again = <Button tone="quiet" onClick={() => void request()} disabled={busy}>{t.requestAgain}</Button>;
  return (
    <section aria-labelledby="bulk-download-h">
      <h3 id="bulk-download-h">{t.title}</h3>
      <p>{t.idle}</p>
      <fieldset disabled={busy}>
        <legend>{t.formatLegend}</legend>
        {BULK_FORMATS.map((value) => (
          <label key={value}>
            <input type="radio" name="bulk-format" value={value} checked={format === value} onChange={() => setFormat(value)} /> {FORMAT_LABEL[value]}
          </label>
        ))}
      </fieldset>
      {view?.kind === "ready" ? (
        <>
          <p role="status">{current?.started === true ? t.started : t.ready}</p>
          <a href={view.href} download onClick={follow}>{t.download}</a>
          <p>{t.expiresAt} {view.until}.</p>
          {current?.started === true && again}
        </>
      ) : view?.kind === "expired" ? (
        <>
          <p role="status">{t.expired}</p>
          <Button onClick={() => void request()} disabled={busy}>{t.requestAgain}</Button>
        </>
      ) : (
        <Button onClick={() => void request()} disabled={busy}>{t.action}</Button>
      )}
      {busy && <p role="status">{t.requesting}</p>}
      {note !== null && <p role="alert">{note}</p>}
    </section>
  );
}
