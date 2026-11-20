"use client";

/**
 * Under a signed receipt (E-11): the PDF record with its QR code (PO-21) and
 * the pointer to the public check. The check page (/provjera, PO-20) has no
 * route yet, so that part says it is not available and links nowhere. It is
 * never a way to sign in (D-09).
 */

import { useState } from "react";
import { Button } from "@ductura/ui";

import { fetchReceiptPdf, runReceiptPdfDownload, saveBlobAs, type PdfDownloadState } from "./receipt-pdf";
import { receiptRecordMessages as t } from "./messages.hr";

export type ReceiptRecordProps = {
  readonly assignmentId: string;
  /** Injected for tests; the page uses the browser's. */
  readonly fetchPdf?: (assignmentId: string) => ReturnType<typeof fetchReceiptPdf>;
  readonly save?: (blob: Blob) => void;
  readonly homeHref?: string;
};

const PROBLEM: Record<Exclude<PdfDownloadState, "idle" | "loading">, string> = {
  notFound: t.pdfNotFound, signedOut: t.pdfSignedOut, failed: t.pdfFailed,
};

export function ReceiptRecord({ assignmentId, fetchPdf = fetchReceiptPdf, save, homeHref }: ReceiptRecordProps) {
  const [state, setState] = useState<PdfDownloadState>("idle");

  async function download() {
    if (state === "loading") return;
    setState("loading");
    setState(await runReceiptPdfDownload(
      () => fetchPdf(assignmentId),
      save ?? ((blob) => saveBlobAs(blob, "zapis-predaje.pdf")),
    ));
  }

  return (
    <section aria-labelledby="receipt-record-title">
      <h3 id="receipt-record-title">{t.verifyTitle}</h3>
      <p>{t.verifyLead}</p>
      <p role="note">{t.verifyPending}</p>
      <p>{t.qrNote}</p>
      <p><Button tone="quiet" busy={state === "loading"} onClick={download}>{state === "loading" ? t.pdfLoading : t.pdf}</Button></p>
      {state !== "idle" && state !== "loading" && <p role="alert">{PROBLEM[state]}</p>}
      {homeHref !== undefined && <p><a href={homeHref}>{t.home}</a></p>}
    </section>
  );
}
