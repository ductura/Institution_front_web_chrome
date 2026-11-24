"use client";

import { Button, Card, DataTable, Tag, type DataTableColumn } from "@ductura/ui";
import { useEffect, useState } from "react";

import { useHost } from "../../context";
import { problemReportsMessages as t } from "./messages.hr";
import { readReports, setReportStatus, type ReportStatus, type ReportsState } from "./read";
import { routingFor, viewerOf, type RoutingRow } from "./routing";
import { reportRows, type ReportRow } from "./view";

const date = new Intl.DateTimeFormat("hr-HR", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Zagreb" });
const routingColumns: DataTableColumn<RoutingRow>[] = [
  { id: "category", header: t.category, cell: (row) => row.label, rowHeader: true },
  { id: "handler", header: t.handler, cell: (row) => (row.yours ? <>{row.handler} <Tag>{t.yours}</Tag></> : row.handler) },
];

/**
 * NF-7 OA-7: the problem reports routed to the reader (operator or the faculty's administrator),
 * read from support.problem-reports.get, and the change of a report's state through
 * support.problem-report-status.post. A new state is shown only after the server confirms it.
 * States: loading, empty, error with a retry, no authority (401/403).
 */
export default function ProblemReportsPage() {
  const { role } = useHost();
  const [view, setView] = useState<ReportsState>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    void readReports().then((result) => { if (active) setView(result); });
    return () => { active = false; };
  }, [attempt]);

  async function change(reference: string, status: ReportStatus) {
    setBusy(reference);
    const result = await setReportStatus(reference, status);
    setBusy(null);
    const say = (text: string) => setNotice(text.replace("{reference}", reference));
    if (result.kind === "changed") {
      say(t.changedOk);
      setView((current) => current.kind !== "ready" ? current : { kind: "ready", data: { ...current.data, reports: current.data.reports.map((r) => (r.reference === reference ? { ...r, status: result.status, statusChangedAt: result.at } : r)) } });
    } else if (result.kind === "denied") say(t.changeDenied);
    else if (result.kind === "gone") { say(t.changeGone); setAttempt((n) => n + 1); }
    else say(t.changeFailed);
  }

  const columns: DataTableColumn<ReportRow>[] = [
    { id: "reference", header: t.reference, cell: (row) => row.reference, rowHeader: true },
    { id: "createdAt", header: t.received, cell: (row) => <time dateTime={row.createdAt}>{date.format(new Date(row.createdAt))}</time> },
    { id: "category", header: t.category, cell: (row) => row.category },
    { id: "handler", header: t.routedTo, cell: (row) => row.handler },
    { id: "description", header: t.description, cell: (row) => row.description },
    { id: "status", header: t.state, cell: (row) => t.stateNames[row.status] },
    {
      id: "action", header: t.actionColumn,
      cell: (row) => {
        const next: ReportStatus = row.status === "received" ? "resolved" : "received";
        return (
          <Button size="small" tone="secondary" busy={busy !== null} aria-label={`${next === "resolved" ? t.markResolved : t.markReceived}: ${row.reference}`} onClick={() => void change(row.reference, next)}>
            {next === "resolved" ? t.markResolved : t.markReceived}
          </Button>
        );
      },
    },
  ];

  return (
    <section className="page" data-role={role ?? undefined} data-nf7="OA-7">
      <h1>{t.title}</h1>
      <p>{t.lead}</p>
      {notice !== null && <p role="status">{notice}</p>}
      {view.kind === "loading" && <Card title={t.reportsTitle} level={2} busy />}
      {view.kind === "denied" && <Card title={t.reportsTitle} level={2} error={t.denied} />}
      {view.kind === "unavailable" && (
        <>
          <Card title={t.reportsTitle} level={2} error={t.unavailable} />
          <Button onClick={() => { setView({ kind: "loading" }); setAttempt((n) => n + 1); }}>{t.retry}</Button>
        </>
      )}
      {view.kind === "ready" && (view.data.reports.length === 0
        ? <Card title={t.emptyTitle} level={2} center empty={t.emptyBody} />
        : (
          <Card title={t.reportsTitle} level={2}>
            <DataTable caption={t.table} columns={columns} rows={reportRows(view.data.reports)} rowKey={(row) => row.reference} empty="" />
            {view.data.truncated && <p>{t.truncated.replace("{count}", String(view.data.reports.length))}</p>}
            <p>{t.privacy}</p>
          </Card>
        ))}
      <Card title={t.routingTitle} level={2}>
        <DataTable caption={t.routingCaption} columns={routingColumns} rows={routingFor(viewerOf(role))} rowKey={(row) => row.category} empty="" />
        <p>{t.states}</p>
      </Card>
    </section>
  );
}
