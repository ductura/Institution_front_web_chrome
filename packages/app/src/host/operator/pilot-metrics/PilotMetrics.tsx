"use client";

import { Button, DataTable, type DataTableColumn } from "@ductura/ui";
import { useEffect, useState } from "react";

import { pilotMetricsMessages as t } from "./messages.hr";
import { readPilotMetrics, type PilotMetricsData, type PilotMetricsState } from "./read";
import styles from "./pilot-metrics.module.css";

type Row = { label: string; value: number | null; duration?: true };
const number = new Intl.NumberFormat("hr-HR");
const date = new Intl.DateTimeFormat("hr-HR", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Zagreb" });

function display({ value, duration }: Row): string {
  if (value === null) return t.hidden;
  const formatted = number.format(value);
  return duration ? t.milliseconds.replace("{value}", formatted) : formatted;
}

const columns: DataTableColumn<Row>[] = [
  { id: "measure", header: t.measure, cell: (row) => row.label, rowHeader: true },
  { id: "value", header: t.value, cell: display, numeric: true },
];

function MetricsView({ data }: { data: PilotMetricsData }) {
  const counts: Row[] = [
    { label: t.recorded, value: data.submissions.recorded },
    { label: t.notRecorded, value: data.submissions.notRecorded },
    { label: t.issued, value: data.receipts.issued },
    { label: t.pending, value: data.receipts.pending },
    { label: t.help, value: data.helpRequests.total },
    { label: t.saveProblems, value: data.helpRequests.saveProblems },
  ];
  const rows: Row[] = [
    ...counts,
    { label: t.median, value: data.receiptTime.p50Ms, duration: true },
    { label: t.p95, value: data.receiptTime.p95Ms, duration: true },
  ];
  const visible = counts.filter((row): row is Row & { value: number } => row.value !== null);
  const max = Math.max(1, ...visible.map((row) => row.value));
  return (
    <>
      <p>{t.asOf} · <time dateTime={data.asOf}>{date.format(new Date(data.asOf))}</time></p>
      {rows.some((row) => row.value === null) && <p>{t.hiddenNote.replace("{minimum}", String(data.minimumGroup))}</p>}
      <DataTable caption={t.table} columns={columns} rows={rows} rowKey={(row) => row.label} empty={t.noMeasures} />
      {visible.length > 0 ? (
        <section className={styles.chart} aria-hidden="true">
          <h2>{t.chart}</h2>
          <ul>
            {visible.map((row) => (
              <li key={row.label}>
                <span>{row.label}</span>
                <span className={styles.track}><span style={{ width: `${row.value / max * 100}%` }} /></span>
                <span>{display(row)}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : <p>{t.noCounts}</p>}
    </>
  );
}

export function PilotMetrics({ home }: { home: string }) {
  const [view, setView] = useState<PilotMetricsState>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    void readPilotMetrics().then((result) => { if (active) setView(result); });
    return () => { active = false; };
  }, [attempt]);

  return (
    <main id="sadrzaj" tabIndex={-1} className={styles.page}>
      <a href={home}>{t.home}</a>
      <h1>{t.title}</h1>
      {view.kind === "loading" && <p role="status">{t.loading}</p>}
      {view.kind === "denied" && <p role="alert">{t.denied}</p>}
      {view.kind === "unavailable" && (
        <>
          <p role="alert">{t.unavailable}</p>
          <Button onClick={() => { setView({ kind: "loading" }); setAttempt((n) => n + 1); }}>{t.retry}</Button>
        </>
      )}
      {view.kind === "ready" && <MetricsView data={view.data} />}
    </main>
  );
}
