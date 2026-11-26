"use client";

// WEB-V13-IZVOZ: "Preuzmi .pptx" and "Preuzmi PDF" for the slides of a work, for the student and the teacher.
// Nothing is offered until the server has confirmed the last revision (`confirmed`); the digest of the
// snapshot is shown from the server's own header. Every state is the server's answer.
import { useEffect, useRef, useState } from "react";
import { Button } from "@ductura/ui";

import { goToSignIn } from "../../../../../../src/client/api";
import { downloadBlob } from "../../../../../../src/components/editor/EarlierDraft";
import { appHref } from "../../../../../../src/components/shell/nav";
import { useHost } from "../../context";
import { exportFileName, requestSlidesExport, type ExportFormat, type ExportResult } from "./export-model.ts";
import { slidesExportText as t } from "./messages.hr.ts";

type Shown =
  | { readonly kind: "idle" }
  | { readonly kind: "preparing" }
  | Exclude<ExportResult, { kind: "signed-out" }>;

const FAILURE: Partial<Record<Shown["kind"], string>> = {
  "not-found": t.notFound, invalid: t.invalid, mismatch: t.mismatch, expired: t.expired, failed: t.failed,
};

export type SlidesExportProps = {
  documentId: string;
  /** The title of the work, for the name of the file. */
  title: string | null;
  /** True only when the server has confirmed the last revision of the slides. */
  confirmed: boolean;
  /** One version to export (the teacher's chosen revision); null for the server's last one. */
  versionId?: string | null;
  /** The path of the screen, for the way back after sign-in. */
  here: string;
  request?: typeof requestSlidesExport;
};

export default function SlidesExport({ documentId, title, confirmed, versionId = null, here, request = requestSlidesExport }: SlidesExportProps) {
  const { base } = useHost();
  const [shown, setShown] = useState<Shown>({ kind: "idle" });
  const control = useRef<AbortController | null>(null);

  useEffect(() => () => control.current?.abort(), []);

  async function start(format: ExportFormat) {
    control.current?.abort();
    const mine = new AbortController();
    control.current = mine;
    setShown({ kind: "preparing" });
    const result = await request(documentId, format, versionId, { signal: mine.signal });
    if (mine.signal.aborted) return;
    if (result.kind === "signed-out") return goToSignIn(appHref(base, here));
    if (result.kind === "ready") downloadBlob(result.blob, exportFileName(title, result.format));
    setShown(result);
  }

  const busy = shown.kind === "preparing";
  const failure = FAILURE[shown.kind];
  const off = busy || !confirmed;
  return (
    <section aria-label={t.region}>
      <div>
        <Button onClick={() => void start("pptx")} disabled={off}>{t.pptx}</Button>
        <Button onClick={() => void start("pdf")} disabled={off}>{t.pdf}</Button>
      </div>
      {!confirmed ? <p role="note">{t.notConfirmed}</p> : null}
      {busy ? <p role="status">{t.preparing}</p> : null}
      {failure !== undefined ? <p role="alert">{failure} {t.retry}</p> : null}
      {shown.kind === "ready" ? (
        <div role="status">
          <p>{shown.format === "pdf" ? t.readyPdf : t.readyPptx}</p>
          <p>{t.snapshot(shown.snapshotSha256.slice(0, 12))}</p>
          <p>{t.snapshotHint}</p>
        </div>
      ) : null}
    </section>
  );
}
