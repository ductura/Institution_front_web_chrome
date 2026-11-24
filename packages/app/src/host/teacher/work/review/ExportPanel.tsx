"use client";

import { Button } from "@ductura/ui";
import { useEffect, useRef, useState } from "react";

import { createApi, goToSignIn } from "../../../../../../../src/client/api";
import { downloadBlob } from "../../../../../../../src/components/editor/EarlierDraft";
import { readPdf, type PdfCall } from "../../../editor/export/pdf";
import type { Grade } from "./model";
import { canExport, exportFileName, failureOf, fingerprintLine, type ExportShown } from "./export-model";
import { exportMessages as t } from "./export-messages.hr";

const defaultCall = (): PdfCall => {
  const api = createApi();
  return (id, input) => api(id, input);
};

export type ExportDeps = {
  /** The call of work.export-pdf.get; the API client by default. */
  readonly call?: () => PdfCall;
  /** Saves the file; a link with `download` by default. */
  readonly save?: (blob: Blob, name: string) => void;
  /** Opens the browser's print dialog. */
  readonly print?: () => void;
  /** Leaves for the sign-in, with the way back to this review. */
  readonly signIn?: () => void;
  readonly now?: () => Date;
};

/**
 * NF-5 PG-11 „Izvoz i ispis” (prototype screen `pregled`, data-nf5="PG-11"): the PDF of the work through
 * work.export-pdf.get, checked against the server's SHA-256, and a print of the whole review from the browser.
 * There is no operation for a PDF of the summary or of the review, so none is offered; the print carries both.
 * A practice assignment is neither exported nor printed. Nothing here writes to the server.
 */
export default function ExportPanel({ assignmentId, documentId, student, grade, deps = {} }: {
  assignmentId: string; documentId: string; student: string | null; grade: Grade; deps?: ExportDeps;
}) {
  const [shown, setShown] = useState<ExportShown>({ kind: "idle" });
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  if (!canExport(grade)) {
    return (
      <section aria-labelledby="pg11-h" data-nf5="PG-11" data-print-hide>
        <h2 id="pg11-h">{t.heading}</h2>
        <p className="note">{t.practice}</p>
      </section>
    );
  }

  async function exportPdf() {
    setShown({ kind: "loading" });
    const result = await readPdf((deps.call ?? defaultCall)(), assignmentId, documentId);
    if (!mounted.current) return;
    if (result.kind === "signed-out") {
      (deps.signIn ?? (() => goToSignIn(window.location.pathname + window.location.search)))();
      return;
    }
    if (result.kind === "ready") {
      (deps.save ?? downloadBlob)(new Blob([result.bytes], { type: "application/pdf" }), exportFileName(student, (deps.now ?? (() => new Date()))()));
    }
    setShown(result);
  }

  const failure = failureOf(shown);
  return (
    <section aria-labelledby="pg11-h" data-nf5="PG-11" data-print-hide>
      <h2 id="pg11-h">{t.heading}</h2>
      <p className="note" data-export-warning>{t.warning}</p>
      <div className="row">
        <Button onClick={() => void exportPdf()} disabled={shown.kind === "loading"}>{failure === null ? t.pdf : t.retry}</Button>
        <Button tone="secondary" onClick={() => (deps.print ?? (() => window.print()))()}>{t.print}</Button>
      </div>
      {shown.kind === "loading" && <p role="status">{t.pdfLoading}</p>}
      {failure !== null && <p role="alert">{failure}</p>}
      {shown.kind === "ready" && (
        <div role="status" data-export-done>
          <p>{t.pdfDone}</p>
          <p>{shown.pdfA ? t.pdfA : t.pdfPlain}</p>
          <p>{fingerprintLine(shown.sha256)}</p>
        </div>
      )}
      <p className="meta">{t.printNote}</p>
      <p className="meta" data-missing="summary-pdf">{t.summaryMissing}</p>
    </section>
  );
}
