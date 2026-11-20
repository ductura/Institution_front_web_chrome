"use client";

import { useEffect, useRef, useState } from "react";
import { Button, Dialog } from "@ductura/ui";

import styles from "./PrintExportDialog.module.css";
import { printExportMessages as t } from "./messages.hr";

export type WorkPrintPreview = { url: string; release: () => void };
export type LoadWorkPreview = (signal: AbortSignal) => Promise<WorkPrintPreview>;
export type DownloadWorkDocx = (signal: AbortSignal) => Promise<void>;

type Props = {
  open: boolean;
  onClose: () => void;
  /** Stable client functions bound to the work and revision being exported. */
  loadPreview: LoadWorkPreview;
  downloadDocx: DownloadWorkDocx;
};

type Preview = { state: "loading" | "failed" } | { state: "ready"; url: string };

function PrintExportContent({ onClose, loadPreview, downloadDocx }: Omit<Props, "open">) {
  const closeButton = useRef<HTMLButtonElement>(null);
  const docxRequest = useRef<AbortController | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [preview, setPreview] = useState<Preview>({ state: "loading" });
  const [word, setWord] = useState<"idle" | "loading" | "failed">("idle");

  useEffect(() => {
    const controller = new AbortController();
    let resource: WorkPrintPreview | undefined;
    async function requestPreview() {
      try {
        const result = await loadPreview(controller.signal);
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

  useEffect(() => {
    setWord("idle");
    return () => {
      docxRequest.current?.abort();
      docxRequest.current = null;
    };
  }, [downloadDocx]);

  async function downloadWord() {
    if (docxRequest.current) return;
    const controller = new AbortController();
    docxRequest.current = controller;
    setWord("loading");
    try {
      await downloadDocx(controller.signal);
      if (!controller.signal.aborted) setWord("idle");
    } catch {
      if (!controller.signal.aborted) setWord("failed");
    } finally {
      if (docxRequest.current === controller) docxRequest.current = null;
    }
  }

  return (
    <Dialog open title={t.title} onClose={onClose} initialFocus={closeButton}
      actions={<>
        <Button tone="quiet" ref={closeButton} onClick={onClose}>{t.close}</Button>
        <Button busy={word === "loading"} onClick={downloadWord}>
          {word === "loading" ? t.wordLoading : t.word}
        </Button>
      </>}
    >
      <div className={styles.preview}>
        {preview.state === "loading" && <p role="status">{t.previewLoading}</p>}
        {preview.state === "failed" && <>
          <p role="alert">{t.previewFailed}</p>
          <Button tone="quiet" onClick={() => setAttempt((previous) => previous + 1)}>{t.retry}</Button>
        </>}
        {preview.state === "ready" && <>
          <a href={preview.url} target="_blank" rel="noopener noreferrer">{t.openPdf}</a>
          <iframe className={styles.pdf} src={preview.url} title={t.pdfTitle} tabIndex={-1} />
        </>}
        {word === "failed" && <p role="alert">{t.wordFailed}</p>}
      </div>
    </Dialog>
  );
}

export function PrintExportDialog({ open, ...props }: Props) {
  // A closed preview has no pending requests or retained PDF.
  return open ? <PrintExportContent {...props} /> : null;
}
