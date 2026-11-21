import { useState } from "react";
import { createRoot } from "react-dom/client";
import { Button } from "@ductura/ui";
import "@ductura/ui/tokens.css";

import { PrintExportDialog, type LoadWorkPreview } from "../PrintExportDialog";
import { WorkPrintExport } from "../docx-download/WorkPrintExport";

const loadPreview: LoadWorkPreview = async (signal) => {
  signal.addEventListener("abort", () => document.body.dataset.aborted = "pdf", { once: true });
  const response = await fetch("/__fixture/export.pdf", { signal });
  if (!response.ok || response.headers.get("content-type") !== "application/pdf") throw new Error("Invalid fixture file");
  const url = URL.createObjectURL(await response.blob());
  return { url, release: () => URL.revokeObjectURL(url) };
};

const docxVersion = {
  documentId: "demo-rad",
  versionId: "42",
  savedAt: "2026-11-21T08:10:00.000Z",
  title: "Izmišljeni rad",
};

function Fixture() {
  const [open, setOpen] = useState(false);
  if (location.search) return <WorkPrintExport documentId={docxVersion.documentId} title={docxVersion.title} />;
  return <>
    <Button onClick={() => setOpen(true)}>Otvori pregled ispisa</Button>
    <PrintExportDialog open={open} onClose={() => setOpen(false)} docxVersion={docxVersion}
      loadPreview={loadPreview} />
  </>;
}

createRoot(document.getElementById("app")!).render(<Fixture />);
