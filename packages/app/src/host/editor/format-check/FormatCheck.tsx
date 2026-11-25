"use client";

// WEB-V17-FORMAT-CHECK: the "Pravila oblika" section of step 3. It reads the assignment's format rules and the
// text the server holds, and lists the deviations per item. Advisory: it never holds the submission.
// Loading, failure and "no rules" are three different states, never one "nothing to report".
import { Button, StepPlaces, StepSection } from "@ductura/ui";
import { useEffect, useState } from "react";

import { checkFormat, type FormatResult } from "./format-check";
import { readFormatRules, type ReadRules } from "./format-rules-port";
import { formatCheckText as t } from "./messages.hr";
import { linesOf, summaryOf } from "./panel-model";
import type { StepWork } from "../../student/submission/summary/model";

export type FormatRead =
  | { readonly kind: "loading" }
  | { readonly kind: "unavailable" }
  | { readonly kind: "noText" }
  | { readonly kind: "ready"; readonly result: FormatResult };

/** One read of the rules and of the work; a failure of either is `unavailable`, an empty work is `noText`. */
export async function readFormatCheck(
  assignmentId: string, readWork: (assignmentId: string) => Promise<StepWork>, readRules?: ReadRules,
): Promise<FormatRead> {
  const [rules, work] = await Promise.all([
    readFormatRules(assignmentId, readRules),
    readWork(assignmentId).catch(() => ({ kind: "unavailable" }) as StepWork),
  ]);
  if (rules.kind !== "ready") return { kind: "unavailable" };
  if (work.kind === "empty") return { kind: "noText" };
  if (work.kind !== "ready" || work.nodes === undefined) return { kind: "unavailable" };
  // A saved blank work (all text deleted) is "ready" on the server; it gets the same treatment as an unstarted one.
  if (work.nodes.every((node) => node.children.every((child) => child.text.trim() === ""))) return { kind: "noText" };
  return { kind: "ready", result: checkFormat(work.nodes, rules.rules) };
}

export function FormatCheckView({ read, onRetry }: { readonly read: FormatRead; readonly onRetry: () => void }) {
  if (read.kind === "loading") return <StepSection label={t.title}><span>{t.loading}</span></StepSection>;
  if (read.kind === "noText") return <StepSection label={t.title}><span>{t.noText}</span></StepSection>;
  if (read.kind === "unavailable") {
    return (
      <StepSection label={t.title}>
        <span role="status">{t.unavailable}</span>
        <Button tone="secondary" size="small" onClick={onRetry}>{t.retry}</Button>
      </StepSection>
    );
  }
  const lines = linesOf(read.result);
  return (
    <StepSection label={t.title}>
      <span>{lines.length === 0 ? t.noRules : summaryOf(read.result)}</span>
      {lines.length > 0 && (
        <StepPlaces>{lines.map((line) => <li key={line.id}>{`${line.label}: ${line.state}. ${line.detail}`}</li>)}</StepPlaces>
      )}
      <span className="meta">{t.advisory}</span>
    </StepSection>
  );
}

export default function FormatCheck({ assignmentId, readWork, readRules }: {
  readonly assignmentId: string;
  readonly readWork: (assignmentId: string) => Promise<StepWork>;
  readonly readRules?: ReadRules;
}) {
  const [read, setRead] = useState<FormatRead>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let live = true;
    setRead({ kind: "loading" });
    void readFormatCheck(assignmentId, readWork, readRules).then((found) => { if (live) setRead(found); });
    return () => { live = false; };
  }, [assignmentId, attempt, readWork, readRules]);
  return <FormatCheckView read={read} onRetry={() => setAttempt((n) => n + 1)} />;
}
