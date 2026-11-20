"use client";

import { useEffect, useRef, useState } from "react";
import { Button, Dialog } from "@ductura/ui";

import styles from "./PrintExportDialog.module.css";
import { printExportMessages as t } from "./messages.hr";

export type LoadWorkExport = (
  format: "pdf" | "docx",
  signal: AbortSignal,
) => Promise<{ file: Blob; filename?: string }>;

type Props = {
  open: boolean;
  onClose: () => void;
  /** Stable loader bound to the work and revision being exported. */
  loadExport: LoadWorkExport;
};

type Preview = { state: "loading" | "failed" } | { state: "ready"; url: string };

function download(file: Blob, filename: string) {
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  // Let Chrome start reading the file before releasing the URL.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

function PrintExportContent({ onClose, loadExport }: Omit<Props, "open">) {
  const closeButton = useRef<HTMLButtonElement>(null);
  const docxRequest = useRef<AbortController | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [preview, setPreview] = useState<Preview>({ state: "loading" });
  const [word, setWord] = useState<"idle" | "loading" | "failed">("idle");

  useEffect(() => {
    const controller = new AbortController();
    let url: string | undefined;
    async function loadPreview() {
      try {
        const { file } = await loadExport("pdf", controller.signal);
        if (controller.signal.aborted) return;
        if (file.type !== "application/pdf" || file.size === 0) {
          setPreview({ state: "failed" });
          return;
        }
        url = URL.createObjectURL(file);
        setPreview({ state: "ready", url });
      } catch {
        if (!controller.signal.aborted) setPreview({ state: "failed" });
      }
    }
    setPreview({ state: "loading" });
    void loadPreview();
    return () => {
      controller.abort();
      if (url) URL.revokeObjectURL(url);
    };
  }, [attempt, loadExport]);

  useEffect(() => {
    setWord("idle");
    return () => {
      docxRequest.current?.abort();
      docxRequest.current = null;
    };
  }, [loadExport]);

  async function downloadWord() {
    if (docxRequest.current) return;
    const controller = new AbortController();
    docxRequest.current = controller;
    setWord("loading");
    try {
      const { file, filename } = await loadExport("docx", controller.signal);
      if (controller.signal.aborted) return;
      if (file.type !== "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || file.size === 0) {
        setWord("failed");
        return;
      }
      download(file, filename?.toLowerCase().endsWith(".docx") ? filename : "rad.docx");
      setWord("idle");
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
