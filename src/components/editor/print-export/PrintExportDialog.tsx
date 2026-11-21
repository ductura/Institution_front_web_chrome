"use client";

import { useEffect, useRef, useState } from "react";
import { Button, Dialog } from "@ductura/ui";

import { DocxDownload, type DocxVersion } from "./docx-download/DocxDownload";
import { docxDownloadMessages } from "./docx-download/messages.hr";
import styles from "./PrintExportDialog.module.css";
import { printExportMessages as t } from "./messages.hr";

export type WorkPrintPreview = { url: string; release: () => void };
export type LoadWorkPreview = (signal: AbortSignal) => Promise<WorkPrintPreview>;

type Props = {
  open: boolean;
  onClose: () => void;
  loadPreview?: LoadWorkPreview;
  docxVersion: DocxVersion;
};

type Preview = { state: "loading" | "failed" } | { state: "ready"; url: string };

function PrintExportContent({ onClose, loadPreview, docxVersion }: Omit<Props, "open">) {
  const closeButton = useRef<HTMLButtonElement>(null);
  const [attempt, setAttempt] = useState(0);
  const [preview, setPreview] = useState<Preview>({ state: "loading" });

  useEffect(() => {
    if (!loadPreview) return;
    const load = loadPreview;
    const controller = new AbortController();
    let resource: WorkPrintPreview | undefined;
    async function requestPreview() {
      try {
        const result = await load(controller.signal);
        if (controller.signal.aborted) {
          result.release();
          return;
        }
        resource = result;
        setPreview({ state: "ready", url: result.url });
      } catch {
        if (!controller.signal.aborted) setPreview({ state: "failed" });
      }
    }
    setPreview({ state: "loading" });
    void requestPreview();
    return () => {
      controller.abort();
      resource?.release();
    };
  }, [attempt, loadPreview]);

  return (
    <Dialog open title={t.title} onClose={onClose} initialFocus={closeButton}
      actions={<Button tone="quiet" ref={closeButton} onClick={onClose}>{t.close}</Button>}
    >
      <div className={loadPreview ? styles.preview : undefined}>
        {!loadPreview && <p>{docxDownloadMessages.pdfSoon}</p>}
        {loadPreview && preview.state === "loading" && <p role="status">{t.previewLoading}</p>}
        {loadPreview && preview.state === "failed" && <>
          <p role="alert">{t.previewFailed}</p>
          <Button tone="quiet" onClick={() => setAttempt((previous) => previous + 1)}>{t.retry}</Button>
        </>}
        {loadPreview && preview.state === "ready" && <>
          <a href={preview.url} target="_blank" rel="noopener noreferrer">{t.openPdf}</a>
          <iframe className={styles.pdf} src={preview.url} title={t.pdfTitle} tabIndex={-1} />
        </>}
        <DocxDownload version={docxVersion} />
      </div>
    </Dialog>
  );
}

export function PrintExportDialog({ open, ...props }: Props) {
  // A closed preview has no pending requests or retained PDF.
  return open ? <PrintExportContent {...props} /> : null;
}
