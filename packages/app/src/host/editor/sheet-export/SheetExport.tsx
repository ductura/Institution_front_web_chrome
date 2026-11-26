"use client";

// WEB-V14-SHEET-EXPORT: "Izvezi CSV" and "Izvezi .xlsx" under the sheet. One download at a time; every answer has its
// own line (loading, done, each failure), and a failure never leaves a file behind. A 401 sends the student to sign in.
import { useEffect, useRef, useState } from "react";
import { Button } from "@ductura/ui";

import { browserTransport, goToSignIn } from "../../../../../../src/client/api";
import { downloadBlob } from "../../../../../../src/components/editor/EarlierDraft";
import { appHref } from "../../../../../../src/components/shell/nav";
import { useHost } from "../../context";
import { sheetExportHr as t } from "./messages.hr";
import { exportFileName, readExport, type ExportKind, type ExportResult, type Transport } from "./port";

type Shown =
  | { readonly kind: "idle" }
  | { readonly kind: "loading"; readonly which: ExportKind }
  | { readonly kind: "done"; readonly which: ExportKind }
  | { readonly kind: "failed"; readonly which: ExportKind; readonly reason: Exclude<ExportResult["kind"], "ready" | "signed-out"> | "offline" };

const FAILURE: Record<Extract<Shown, { kind: "failed" }>["reason"], string> = {
  "not-found": t.notFound,
  invalid: t.invalid,
  unavailable: t.unavailable,
  mismatch: t.mismatch,
  "not-a-file": t.notAFile,
  offline: t.offline,
};

export default function SheetExport({ documentId, title, here, transport = browserTransport, online = () => globalThis.navigator?.onLine !== false }: {
  documentId: string;
  title: string | null;
  /** The path of the screen, for the way back after sign-in. */
  here: string;
  transport?: Transport;
  online?: () => boolean;
}) {
  const { base } = useHost();
  const [shown, setShown] = useState<Shown>({ kind: "idle" });
  const mounted = useRef(true);
  const abort = useRef<AbortController | null>(null);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; abort.current?.abort(); };
  }, []);

  async function start(which: ExportKind) {
    if (!online()) { setShown({ kind: "failed", which, reason: "offline" }); return; }
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    setShown({ kind: "loading", which });
    const result = await readExport(transport, which, documentId, controller.signal);
    if (!mounted.current || controller.signal.aborted) return;
    if (result.kind === "signed-out") { goToSignIn(appHref(base, here)); return; }
    if (result.kind === "ready") {
      downloadBlob(new Blob([result.bytes], { type: result.mime }), exportFileName(title, which));
      setShown({ kind: "done", which });
      return;
    }
    setShown({ kind: "failed", which, reason: result.kind });
  }

  const busy = shown.kind === "loading";
  const label = (which: ExportKind) => (shown.kind === "failed" && shown.which === which ? t.retry : which === "csv" ? t.csv : t.xlsx);
  return (
    <div role="group" aria-label={t.groupLabel}>
      <Button tone="secondary" onClick={() => void start("csv")} disabled={busy}>{label("csv")}</Button>
      <Button tone="secondary" onClick={() => void start("xlsx")} disabled={busy}>{label("xlsx")}</Button>
      <p>{t.firstSheetNote} {t.savedNote}</p>
      {shown.kind === "loading" ? <p role="status">{t.loading(shown.which === "csv" ? t.csvWhat : t.xlsxWhat)}</p> : null}
      {shown.kind === "done" ? <p role="status">{shown.which === "csv" ? t.doneCsv : t.doneXlsx}</p> : null}
      {shown.kind === "failed" ? <p role="alert">{FAILURE[shown.reason]}</p> : null}
    </div>
  );
}
