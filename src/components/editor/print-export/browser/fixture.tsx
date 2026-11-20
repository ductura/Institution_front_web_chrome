import { useState } from "react";
import { createRoot } from "react-dom/client";
import { Button } from "@ductura/ui";
import "@ductura/ui/tokens.css";

import { PrintExportDialog, type LoadWorkExport } from "../PrintExportDialog";

const loadExport: LoadWorkExport = async (format, signal) => {
  signal.addEventListener("abort", () => document.body.dataset.aborted = format, { once: true });
  const response = await fetch(`/__fixture/export.${format}`, { signal });
  if (!response.ok) throw new Error(String(response.status));
  return { file: await response.blob(), filename: "izmisljeni-rad.docx" };
};

function Fixture() {
  const [open, setOpen] = useState(false);
  return <>
    <Button onClick={() => setOpen(true)}>Otvori pregled ispisa</Button>
    <PrintExportDialog open={open} onClose={() => setOpen(false)} loadExport={loadExport} />
  </>;
}

createRoot(document.getElementById("app")!).render(<Fixture />);
