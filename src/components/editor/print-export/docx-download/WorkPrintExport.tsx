"use client";

import { useEffect, useState } from "react";
import { Button } from "@ductura/ui";

import { readTimeMachineVersions } from "../../../../client/time-machine";
import { PrintExportDialog } from "../PrintExportDialog";
import { printExportMessages as t } from "../messages.hr";
import type { ReactNode } from "react";
import type { DocxVersion } from "./DocxDownload";

function OpenWorkPrintExport({ documentId, title, onClose, renderPdf }: {
  documentId: string;
  title: string;
  onClose: () => void;
  renderPdf?: RenderPdf;
}) {
  const [version, setVersion] = useState<DocxVersion>("loading");

  useEffect(() => {
    let open = true;
    void readTimeMachineVersions(documentId).then((result) => {
      if (!open) return;
      if (result.kind !== "ready") {
        setVersion("unavailable");
        return;
      }
      const latest = result.versions[0];
      if (latest && !Number.isFinite(Date.parse(latest.savedMinute))) {
        setVersion("unavailable");
        return;
      }
      setVersion(latest ? {
        documentId,
        title,
        versionId: String(latest.revision),
        savedAt: latest.savedMinute,
      } : null);
    });
    return () => { open = false; };
  }, [documentId, title]);

  const pdfExport = renderPdf === undefined ? undefined
    : version && typeof version === "object" ? renderPdf({ documentId, versionId: version.versionId, title }) : null;
  return <PrintExportDialog open onClose={onClose} docxVersion={version} pdfExport={pdfExport} />;
}

/** The host draws the PDF download for a saved version (WEB-1803). */
export type RenderPdf = (version: { documentId: string; versionId: string; title: string }) => ReactNode;

export function WorkPrintExport({ documentId, title, renderPdf }: { documentId: string; title: string; renderPdf?: RenderPdf }) {
  const [open, setOpen] = useState(false);
  return <>
    <Button tone="quiet" onClick={() => setOpen(true)}>{t.title}</Button>
    {open && <OpenWorkPrintExport key={documentId} documentId={documentId} title={title} onClose={() => setOpen(false)} renderPdf={renderPdf} />}
  </>;
}
