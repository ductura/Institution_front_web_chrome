"use client";

// WEB-V14-SHEET-SUBMIT: the sheet block of step 3 ("Prije predaje") and of the receipt. It shows the kind and the
// number of sheets, filled cells and formulas of the work the server holds. Nothing is shown for a text or slides
// work; loading and a failed read are their own lines, never "empty".
import { Button, StepSection } from "@ductura/ui";
import { useEffect, useState } from "react";

import { sheetsWord } from "./model.ts";
import { sheetSummaryText as t } from "./messages.hr.ts";
import { readSheetWork, type SheetWorkRead } from "./read.ts";

const line = (n: number, words: { one: string; few: string; many: string }) => sheetsWord(n, words).replace("{n}", String(n));

export default function SheetSummary({ assignmentId, read = readSheetWork, onSignIn }: {
  assignmentId: string; read?: (assignmentId: string) => Promise<SheetWorkRead>; onSignIn?: () => void;
}) {
  const [state, setState] = useState<SheetWorkRead | "loading">("loading");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let live = true;
    setState("loading");
    void read(assignmentId).then((answer) => { if (live) setState(answer); });
    return () => { live = false; };
  }, [assignmentId, read, attempt]);
  useEffect(() => { if (state !== "loading" && state.kind === "signIn") onSignIn?.(); }, [state, onSignIn]);

  if (state !== "loading" && (state.kind === "other" || state.kind === "signIn")) return null;
  return (
    <StepSection label={t.title}>
      {state === "loading" ? <span role="status">{t.loading}</span>
        : state.kind === "unavailable" ? <><span role="alert">{t.unavailable}</span><Button tone="secondary" onClick={() => setAttempt((n) => n + 1)}>{t.retry}</Button></>
        : state.kind !== "sheet" ? <span>{t.empty}</span>
        : <>
          <span>{t.kind}</span>
          <span>{line(state.summary.sheets, t.sheets)}, {line(state.summary.filledCells, t.cells)}, {line(state.summary.formulas, t.formulas)}</span>
          <span className="meta">{t.meta}</span>
        </>}
    </StepSection>
  );
}
