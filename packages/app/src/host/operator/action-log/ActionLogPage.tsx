"use client";

import { Button, Card, DataTable, type DataTableColumn } from "@ductura/ui";
import { useEffect, useState } from "react";

import { useHost } from "../../context";
import { actionLogMessages as t } from "./messages.hr";
import { readActionLog, type ActionLogState } from "./read";
import { rowsOf, type ActionRow } from "./view";

const date = new Intl.DateTimeFormat("hr-HR", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Zagreb" });
const columns: DataTableColumn<ActionRow>[] = [
  { id: "at", header: t.when, cell: (row) => <time dateTime={row.at}>{date.format(new Date(row.at))}</time>, rowHeader: true },
  { id: "action", header: t.action, cell: (row) => row.action },
  { id: "actor", header: t.actor, cell: (row) => row.actor },
  { id: "subject", header: t.subject, cell: (row) => row.subject },
];

/**
 * NF-7 OA-3: the log of the administrators' and operators' actions, read only, from
 * institution.admin-actions.get through the shared client. States: loading, empty, error with a
 * retry, and "no authority" (401/403). The host lets only the operator's and the administrator's
 * accounts in; the entries carry roles and times, never a student.
 */
export default function ActionLogPage() {
  const { role } = useHost();
  const [view, setView] = useState<ActionLogState>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    void readActionLog().then((result) => { if (active) setView(result); });
    return () => { active = false; };
  }, [attempt]);

  return (
    <section className="page" data-role={role ?? undefined} data-nf7="OA-3">
      <h1>{t.title}</h1>
      <p>{t.lead}</p>
      {view.kind === "loading" && <Card title={t.entriesTitle} level={2} busy />}
      {view.kind === "denied" && <Card title={t.entriesTitle} level={2} error={t.denied} />}
      {view.kind === "unavailable" && (
        <>
          <Card title={t.entriesTitle} level={2} error={t.unavailable} />
          <Button onClick={() => { setView({ kind: "loading" }); setAttempt((n) => n + 1); }}>{t.retry}</Button>
        </>
      )}
      {view.kind === "ready" && (view.data.entries.length === 0
        ? <Card title={t.emptyTitle} level={2} center empty={t.emptyBody} />
        : (
          <Card title={t.entriesTitle} level={2}>
            <DataTable caption={t.table} columns={columns} rows={rowsOf(view.data.entries)} rowKey={(row) => row.id} empty="" />
            {view.data.truncated && <p>{t.truncated.replace("{count}", String(view.data.entries.length))}</p>}
            <p>{t.privacy}</p>
          </Card>
        ))}
    </section>
  );
}
