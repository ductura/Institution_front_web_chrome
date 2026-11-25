"use client";

import { Button, Card, DataTable, ToastRegion, useToasts, type DataTableColumn } from "@ductura/ui";
import { useState } from "react";

import type { AnalysisResponse, AnalysisRunState } from "../api/run";
import { correlationMatrix, correlationVariables, formatNumber, formatShare, groupDigest, isDigest, type MatrixRow } from "./format";
import { resultMessages as t } from "./messages.hr";

type Result = AnalysisResponse["result"];
type Descriptive = Extract<Result, { kind: "descriptive" }>["columns"][number];
type FrequencyColumn = Extract<Result, { kind: "frequencies" }>["columns"][number];
type Pair = Extract<Result, { kind: "correlation" }>["pairs"][number];

/** Puts the digest on the clipboard. The outcome decides the toast: the confirmation only after the write succeeded. */
export async function copyFingerprint(
  value: string,
  clipboard: Pick<Clipboard, "writeText"> | undefined = typeof navigator === "undefined" ? undefined : navigator.clipboard,
): Promise<"copied" | "failed"> {
  if (!isDigest(value) || clipboard === undefined) return "failed";
  try {
    await clipboard.writeText(value);
    return "copied";
  } catch {
    return "failed";
  }
}

function FingerprintRow({ label, value, buttonLabel, onCopy, busy }: {
  label: string; value: string; buttonLabel: string; onCopy: (value: string) => void; busy: boolean;
}) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>
        <code>{groupDigest(value)}</code>{" "}
        <Button tone="quiet" busy={busy} aria-label={buttonLabel} onClick={() => onCopy(value)}>{t.copyFingerprint}</Button>
      </dd>
    </div>
  );
}

const num = formatNumber;
const DESCRIPTIVE: DataTableColumn<Descriptive>[] = [
  { id: "name", header: t.descriptive.variable, cell: (r) => r.name, rowHeader: true },
  { id: "n", header: t.descriptive.n, cell: (r) => formatNumber(r.n), numeric: true },
  { id: "missing", header: t.descriptive.missing, cell: (r) => formatNumber(r.missing), numeric: true },
  { id: "mean", header: t.descriptive.mean, cell: (r) => num(r.mean), numeric: true },
  { id: "sd", header: t.descriptive.sd, cell: (r) => num(r.sd), numeric: true },
  { id: "median", header: t.descriptive.median, cell: (r) => num(r.median), numeric: true },
  { id: "min", header: t.descriptive.min, cell: (r) => num(r.min), numeric: true },
  { id: "q1", header: t.descriptive.q1, cell: (r) => num(r.q1), numeric: true },
  { id: "q3", header: t.descriptive.q3, cell: (r) => num(r.q3), numeric: true },
  { id: "max", header: t.descriptive.max, cell: (r) => num(r.max), numeric: true },
];

type FrequencyRow = { readonly key: string; readonly value: string; readonly count: number; readonly share: number | null };
const FREQUENCY: DataTableColumn<FrequencyRow>[] = [
  { id: "value", header: t.frequencies.value, cell: (r) => r.value, rowHeader: true },
  { id: "count", header: t.frequencies.count, cell: (r) => formatNumber(r.count), numeric: true },
  { id: "share", header: t.frequencies.share, cell: (r) => formatShare(r.share), numeric: true },
];

/** The rows of one frequency table, in the server's order; values past the limit are one line, not hidden. */
export function frequencyRows(column: FrequencyColumn): FrequencyRow[] {
  const rows: FrequencyRow[] = column.values.map((v, index) => ({ key: `v${index}`, value: v.value, count: v.count, share: v.share }));
  if (column.otherCount > 0) {
    rows.push({ key: "other", value: t.frequencies.other, count: column.otherCount, share: column.n > 0 ? column.otherCount / column.n : null });
  }
  return rows;
}

const PAIRS: DataTableColumn<Pair>[] = [
  { id: "a", header: t.correlation.a, cell: (r) => r.a, rowHeader: true },
  { id: "b", header: t.correlation.b, cell: (r) => r.b },
  { id: "n", header: t.correlation.n, cell: (r) => formatNumber(r.n), numeric: true },
  { id: "r", header: t.correlation.r, cell: (r) => num(r.r), numeric: true },
];

function matrixColumns(names: readonly string[]): DataTableColumn<MatrixRow>[] {
  return [
    { id: "name", header: t.correlation.a, cell: (row) => row.name, rowHeader: true },
    ...names.map((name, index): DataTableColumn<MatrixRow> => ({
      id: `c${index}`, header: name, numeric: true,
      cell: (row) => {
        const cell = row.cells[index];
        return cell === "diagonal" ? t.correlation.diagonal : cell === "missing" ? t.correlation.pairMissing : num(cell ?? null);
      },
    })),
  ];
}

function ResultTables({ result }: { result: Result }) {
  switch (result.kind) {
    case "descriptive":
      return <DataTable caption={t.descriptive.caption} columns={DESCRIPTIVE} rows={result.columns} rowKey={(r) => r.name} empty={t.emptyBody} />;
    case "frequencies":
      return (
        <>
          {result.columns.map((column) => (
            <div key={column.name}>
              <p>{t.frequencies.summary.replace("{n}", formatNumber(column.n)).replace("{missing}", formatNumber(column.missing))}</p>
              <DataTable
                caption={t.frequencies.caption.replace("{name}", column.name)} columns={FREQUENCY} rows={frequencyRows(column)}
                rowKey={(r) => r.key} empty={t.frequencies.none}
              />
            </div>
          ))}
        </>
      );
    case "correlation": {
      const names = correlationVariables(result.pairs);
      return (
        <>
          <DataTable caption={t.correlation.listCaption} columns={PAIRS} rows={result.pairs} rowKey={(r) => `${r.a}\u0000${r.b}`} empty={t.emptyBody} />
          {names.length > 1 && (
            <DataTable caption={t.correlation.matrixCaption} columns={matrixColumns(names)} rows={correlationMatrix(result.pairs)} rowKey={(r) => r.name} empty={t.emptyBody} />
          )}
        </>
      );
    }
  }
}

/** A result with nothing to show (no column, no pair) is empty; a failure or a loading state is never this. */
export const isEmptyResult = (result: Result): boolean => (result.kind === "correlation" ? result.pairs.length === 0 : result.columns.length === 0);

function ReadyView({ data }: { data: AnalysisResponse }) {
  const { toasts, show, dismiss } = useToasts();
  const [copying, setCopying] = useState<string | null>(null);
  async function copy(value: string) {
    setCopying(value);
    const outcome = await copyFingerprint(value);
    setCopying(null);
    if (outcome === "copied") show(t.copied);
    else show(t.copyFailed, "error");
  }
  if (isEmptyResult(data.result)) return <Card title={t.emptyTitle} level={2} center empty={t.emptyBody} />;
  return (
    <Card title={t.analysisNames[data.analysisId]} level={2}>
      <dl>
        <div><dt>{t.analysisVersion}</dt><dd>{data.analysisVersion}</dd></div>
        <div><dt>{t.rowCount}</dt><dd>{formatNumber(data.rowCount)}</dd></div>
        <FingerprintRow label={t.datasetSha256} value={data.datasetSha256} buttonLabel={t.copyDataset} onCopy={copy} busy={copying === data.datasetSha256} />
        <FingerprintRow label={t.resultSha256} value={data.resultSha256} buttonLabel={t.copyResult} onCopy={copy} busy={copying === data.resultSha256} />
      </dl>
      <p>{t.sampleNote}</p>
      <ResultTables result={data.result} />
      <ToastRegion toasts={toasts} onDismiss={dismiss} label={t.notifications} closeLabel={t.close} />
    </Card>
  );
}

const ERRORS = { off: t.off, unavailable: t.unavailable, tooLarge: t.tooLarge, invalid: t.invalid, failed: t.failed } as const;

/**
 * WEB-V15-PRIKAZ-REZULTATA: shows one result of analysis.runs.post by `kind`. Loading, a refused or failed call and
 * the function being off are each their own state and never the empty one (a 503 is not "no data"). Numbers use the
 * decimal comma, `null` reads "nije definirano" and never 0. Nothing here ranks, grades or compares people.
 */
export function ResultView({ state, onRetry }: { state: AnalysisRunState; onRetry?: () => void }) {
  if (state.kind === "loading") return <Card title={t.title} level={2} busy />;
  if (state.kind === "ready") return <ReadyView data={state.data} />;
  return (
    <>
      <Card title={t.title} level={2} error={ERRORS[state.kind]} />
      {state.kind === "unavailable" && onRetry !== undefined && <Button onClick={onRetry}>{t.retry}</Button>}
    </>
  );
}
