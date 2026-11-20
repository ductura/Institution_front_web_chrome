import { useState } from "react";
import { createRoot } from "react-dom/client";
import { Button } from "@ductura/ui";
import "@ductura/ui/tokens.css";

import { PrintExportDialog, type DownloadWorkDocx, type LoadWorkPreview } from "../PrintExportDialog";

async function loadFile(format: "pdf" | "docx", contentType: string, signal: AbortSignal) {
  signal.addEventListener("abort", () => document.body.dataset.aborted = format, { once: true });
  const response = await fetch(`/__fixture/export.${format}`, { signal });
  if (!response.ok || response.headers.get("content-type") !== contentType) throw new Error("Invalid fixture file");
  return URL.createObjectURL(await response.blob());
}

const loadPreview: LoadWorkPreview = async (signal) => {
  const url = await loadFile("pdf", "application/pdf", signal);
  return { url, release: () => URL.revokeObjectURL(url) };
};

const downloadDocx: DownloadWorkDocx = async (signal) => {
  const url = await loadFile("docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", signal);
  const link = document.createElement("a");
  link.href = url;
  link.download = "izmisljeni-rad.docx";
  if (!signal.aborted) link.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
};

function Fixture() {
  const [open, setOpen] = useState(false);
  return <>
    <Button onClick={() => setOpen(true)}>Otvori pregled ispisa</Button>
    <PrintExportDialog open={open} onClose={() => setOpen(false)} loadPreview={loadPreview} downloadDocx={downloadDocx} />
  </>;
}

createRoot(document.getElementById("app")!).render(<Fixture />);
