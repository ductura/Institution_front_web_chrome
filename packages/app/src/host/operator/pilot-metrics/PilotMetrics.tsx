"use client";

import { Button, Card, DataTable, type DataTableColumn } from "@ductura/ui";
import { useEffect, useState } from "react";

import { ACTION_LOG, PROBLEM_REPORTS } from "../paths";
import { appHref } from "@/components/index";
import { useHost } from "../../context";
import { pilotMetricsMessages as t } from "./messages.hr";
import { readPilotMetrics, type PilotMetricsData, type PilotMetricsState } from "./read";
import { isEmpty, measuresOf, type MeasureRow } from "./view";
import styles from "./pilot-metrics.module.css";

const number = new Intl.NumberFormat("hr-HR");
const date = new Intl.DateTimeFormat("hr-HR", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Zagreb" });

function display({ value, duration }: MeasureRow, minimum: number): string {
  if (value === null) return t.hidden.replace("{minimum}", String(minimum));
  const formatted = number.format(value);
  return duration ? t.milliseconds.replace("{value}", formatted) : formatted;
}

const columnsFor = (minimum: number): DataTableColumn<MeasureRow>[] => [
  { id: "measure", header: t.measure, cell: (row) => row.label, rowHeader: true },
  { id: "value", header: t.value, cell: (row) => display(row, minimum), numeric: true },
];

function MetricsView({ data }: { data: PilotMetricsData }) {
  const rows = measuresOf(data);
  const columns = columnsFor(data.minimumGroup);
  const visible = rows.filter((row): row is MeasureRow & { value: number } => !row.duration && row.value !== null);
  const max = Math.max(1, ...visible.map((row) => row.value));
  return (
    <Card title={t.overview} level={2}>
      <p>{t.asOf} · <time dateTime={data.asOf}>{date.format(new Date(data.asOf))}</time></p>
      {rows.some((row) => row.value === null) && <p>{t.hiddenNote.replace("{minimum}", String(data.minimumGroup))}</p>}
      <DataTable caption={t.table} columns={columns} rows={rows} rowKey={(row) => row.id} empty={t.noMeasures} />
      {visible.length > 0 ? (
        <section className={styles.chart} aria-hidden="true">
          <h3>{t.chart}</h3>
          <ul>
            {visible.map((row) => (
              <li key={row.id}>
                <span>{row.label}</span>
                <span className={styles.track}><span style={{ width: `${row.value / max * 100}%` }} /></span>
                <span>{display(row, data.minimumGroup)}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : <p>{t.noCounts}</p>}
    </Card>
  );
}

/**
 * WEB-NUZ-OPERATER (NF-7 OA-1, OA-12): the operator's view of the institution, inside the host's
 * shell. Only the aggregates of ops.pilot-metrics.get, through the shared client; the host lets only
 * the operator's account open the page (routes.ts), and the server's 401/403 is shown as a refusal.
 * The states of the prototype: loading, empty, error with "Pokušaj ponovno", and the measures.
 */
export function PilotMetrics() {
  const { base, role } = useHost();
  const [view, setView] = useState<PilotMetricsState>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    void readPilotMetrics().then((result) => { if (active) setView(result); });
    return () => { active = false; };
  }, [attempt]);

  return (
    <section className="page" data-role={role ?? undefined} data-nf7="OA-1">
      <h1>{t.title}</h1>
      <p>{t.lead}</p>
      <nav aria-label={t.more}>
        <p><a href={appHref(base, ACTION_LOG)}>{t.actionLog}</a></p>
        <p><a href={appHref(base, PROBLEM_REPORTS)}>{t.problemReports}</a></p>
      </nav>
      {view.kind === "loading" && <Card title={t.overview} level={2} busy />}
      {view.kind === "denied" && <Card title={t.overview} level={2} error={t.denied} />}
      {view.kind === "unavailable" && (
        <>
          <Card title={t.overview} level={2} error={t.unavailable} />
          <Button onClick={() => { setView({ kind: "loading" }); setAttempt((n) => n + 1); }}>{t.retry}</Button>
        </>
      )}
      {view.kind === "ready" && (isEmpty(view.data)
        ? <Card title={t.emptyTitle} level={2} center empty={t.emptyBody} />
        : <MetricsView data={view.data} />)}
    </section>
  );
}
