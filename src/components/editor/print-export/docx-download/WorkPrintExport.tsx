"use client";

import { useEffect, useState } from "react";
import { Button } from "@ductura/ui";

import { readTimeMachineVersions } from "../../../../client/time-machine";
import { PrintExportDialog } from "../PrintExportDialog";
import { printExportMessages as t } from "../messages.hr";
import type { DocxVersion } from "./DocxDownload";

function OpenWorkPrintExport({ documentId, title, onClose }: {
  documentId: string;
  title: string;
  onClose: () => void;
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

  return <PrintExportDialog open onClose={onClose} docxVersion={version} />;
}

export function WorkPrintExport({ documentId, title }: { documentId: string; title: string }) {
  const [open, setOpen] = useState(false);
  return <>
    <Button tone="quiet" onClick={() => setOpen(true)}>{t.title}</Button>
    {open && <OpenWorkPrintExport key={documentId} documentId={documentId} title={title} onClose={() => setOpen(false)} />}
  </>;
}
