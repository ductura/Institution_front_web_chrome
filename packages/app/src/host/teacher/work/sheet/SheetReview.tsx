"use client";

// WEB-V14-SHEET-SUBMIT: the teacher reads a spreadsheet work (grid, read only). `SheetOrWork` is the branch the
// teacher's work page makes by kind: a spreadsheet opens here, any other work keeps the existing page (`fallback`),
// which shows its own 401/404/unavailable. The existing page is shown at once and stays until the kind is known.
import { useEffect, useState, type ReactNode } from "react";

import { goToSignIn } from "../../../../../../../src/client/api.ts";
import { appHref } from "../../../../../../../src/components/shell/nav.ts";
import { useHost } from "../../../context";
import { SheetGrid } from "../../../editor/sheet/SheetGrid.tsx";
import { sheetReviewText as t } from "./messages.hr.ts";
import { readSheetReview, type SheetRead } from "./read.ts";

const noop = () => undefined;

export function SheetOrWork({ documentId, path, fallback, read = readSheetReview }: {
  documentId: string; path: string; fallback: ReactNode; read?: (documentId: string) => Promise<SheetRead>;
}) {
  const { base } = useHost();
  const [answer, setAnswer] = useState<SheetRead | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let live = true;
    setAnswer(null);
    void read(documentId).then((value) => { if (live) setAnswer(value); });
    return () => { live = false; };
  }, [documentId, read, attempt]);
  const kind = answer?.kind;
  useEffect(() => { if (kind === "signedOut") goToSignIn(appHref(base, path)); }, [kind, base, path]);

  if (answer === null || answer.kind === "text" || answer.kind === "unknown" || answer.kind === "signedOut" || answer.kind === "notFound") return <>{fallback}</>;
  return (
    <div className="page">
      <h1>{t.title}</h1>
      <p role="note">{t.readOnly}</p>
      {answer.kind === "sheet" ? <p>{t.revision.replace("{n}", String(answer.revision))}</p> : null}
      <SheetGrid state={answer.kind === "sheet" ? "ready" : "error"} document={answer.kind === "sheet" ? answer.document : null}
        onChange={noop} onRetry={() => setAttempt((n) => n + 1)} readOnly />
    </div>
  );
}
