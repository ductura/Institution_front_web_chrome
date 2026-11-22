"use client";

import { useEffect, useState } from "react";
import { Button } from "@ductura/ui";

import { BULK_FORMATS, requestBulkLink, type BulkCall, type BulkFormat, type BulkLink } from "./contract";
import { bulkText as t } from "./messages.hr";
import { requestFailure, viewOf } from "./model";

const FORMAT_LABEL: Record<BulkFormat, string> = { pdf: t.formatPdf, docx: t.formatDocx };

/**
 * The button "Preuzmi sve predaje" of the submissions table (WEB-1902; P-D2; WEB-2004): the server answers
 * with a link that expires, the screen shows it as a link with the expiry the server states. There is no
 * background job to wait for. The submissions screen mounts it above the table.
 */
export default function BulkDownload(
  { call, assignmentId, now = () => new Date(), onSignedOut }: { call: BulkCall; assignmentId: string; now?: () => Date; onSignedOut?: () => void },
) {
  const [format, setFormat] = useState<BulkFormat>("pdf");
  const [state, setState] = useState<{ assignmentId: string; link: BulkLink } | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const link = state?.assignmentId === assignmentId ? state.link : null;

  useEffect(() => {
    setBusy(false);
    setNote(null);
    setState(null);
  }, [assignmentId]);

  async function request() {
    if (busy) return;
    setBusy(true);
    setNote(null);
    const asked = assignmentId;
    const outcome = await requestBulkLink(call, asked, format);
    setBusy(false);
    if (outcome.kind === "poveznica") setState((cur) => (cur === null || cur.assignmentId === asked ? { assignmentId: asked, link: outcome.link } : cur));
    else if (outcome.kind === "session-expired") onSignedOut?.();
    else setNote(requestFailure(outcome));
  }

  const view = link === null ? null : viewOf(link, now());
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
          <p role="status">{t.ready}</p>
          <a href={view.href} download>{t.download}</a>
          <p>{t.expiresAt} {view.until}.</p>
        </>
      ) : (
        <>
          {view?.kind === "expired" && <p role="alert">{t.expired}</p>}
          <Button onClick={() => void request()} disabled={busy}>{view?.kind === "expired" ? t.requestAgain : t.action}</Button>
        </>
      )}
      {busy && <p role="status">{t.requesting}</p>}
      {note !== null && <p role="alert">{note}</p>}
    </section>
  );
}
