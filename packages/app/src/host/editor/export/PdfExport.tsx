"use client";

// WEB-1803, WEB-2005: "Preuzmi PDF" in the print preview, through work.export-pdf.get. The "PDF/A" mark is
// drawn only when the server's answer says so; it is never assumed.
import { useEffect, useRef, useState } from "react";
import { Button } from "@ductura/ui";

import { createApi, goToSignIn } from "../../../../../../src/client/api";
import { downloadBlob } from "../../../../../../src/components/editor/EarlierDraft";
import { appHref } from "../../../../../../src/components/shell/nav";
import { useHost } from "../../context";
import { pdfFileName } from "./contract";
import { pdfExportText as t } from "./messages.hr";
import { readPdf, type PdfCall, type PdfResult } from "./pdf";

const defaultCall = (): PdfCall => {
  const api = createApi();
  return (id, input) => api(id, input);
};

export type PdfExportVersion = { readonly documentId: string; readonly versionId: string; readonly title: string };

type Shown = { readonly kind: "idle" } | { readonly kind: "loading" } | Exclude<PdfResult, { kind: "signed-out" }>;

const FAILURE: Partial<Record<Shown["kind"], string>> = {
  "not-found": t.notFound,
  forbidden: t.forbidden,
  mismatch: t.mismatch,
  unavailable: t.unavailable,
};

export default function PdfExport({ assignmentId, version, here, call = defaultCall }: {
  assignmentId: string;
  /** The server exports the submitted or the last saved revision of this work; `versionId` names no other. */
  version: PdfExportVersion;
  /** The path of the screen, for the way back after sign-in. */
  here: string;
  call?: () => PdfCall;
}) {
  const { base } = useHost();
  const [shown, setShown] = useState<Shown>({ kind: "idle" });
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  async function start() {
    setShown({ kind: "loading" });
    const result = await readPdf(call(), assignmentId, version.documentId);
    if (!mounted.current) return;
    if (result.kind === "signed-out") {
      goToSignIn(appHref(base, here));
      return;
    }
    if (result.kind === "ready") downloadBlob(new Blob([result.bytes], { type: "application/pdf" }), pdfFileName(version.title));
    setShown(result);
  }

  const failure = FAILURE[shown.kind];
  return (
    <div>
      <Button onClick={() => void start()} disabled={shown.kind === "loading"}>
        {failure === undefined ? t.start : t.retry}
      </Button>
      {shown.kind === "loading" ? <p role="status">{t.loading}</p> : null}
      {failure !== undefined ? <p role="alert">{failure}</p> : null}
      {shown.kind === "ready" ? (
        <div role="status">
          <p>{t.done}</p>
          {shown.pdfA ? <p><strong>{t.pdfA}</strong> {t.pdfAExplain}</p> : <p>{t.plain}</p>}
          <p>{t.fingerprint(shown.sha256.slice(0, 12))}</p>
        </div>
      ) : null}
    </div>
  );
}
