"use client";

// WEB-2134: "LaTeX (.tex)" in the Izvezi menu (stem.js `stTex`). The file is built on the device from the work
// the editor holds; nothing is sent. Where a download cannot start, the text says so instead of claiming it did.
import { Button } from "@ductura/ui";
import { useState } from "react";

import { downloadBlob } from "../../../../../../src/components/editor/EarlierDraft";
import type { CanonicalDocumentV4 } from "../../../../../editor-core/src/document/document/index.ts";
import type { CitationStyle } from "../../../../../editor-core/src/document/citation/style";
import { buildTex, TEX_FILE } from "./latex";
import { stemHr as t } from "./messages.hr";

type State = "idle" | "done" | "failed";

export default function LatexExport({ doc, title, style, canDownload = true }: {
  doc: CanonicalDocumentV4;
  title: string;
  style: CitationStyle;
  canDownload?: boolean;
}) {
  const [state, setState] = useState<State>("idle");
  const hasImages = doc.nodes.some((n) => n.type === "image");

  function start() {
    try {
      downloadBlob(new Blob([buildTex(doc, { title, style })], { type: "application/x-tex;charset=utf-8" }), TEX_FILE);
      setState("done");
    } catch {
      setState("failed");
    }
  }

  return (
    <div>
      <Button tone="quiet" onClick={start} disabled={!canDownload}>{t.latex.item}</Button>
      <p><small>{t.latex.note}{hasImages ? ` ${t.latex.imagesNote}` : ""}</small></p>
      {!canDownload && <p role="status">{t.latex.unavailable}</p>}
      {state === "done" && <p role="status">{t.latex.done}</p>}
      {state === "failed" && <p role="alert">{t.latex.failed}</p>}
    </div>
  );
}
