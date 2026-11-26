"use client";

import { Button, Card, DataTable, type DataTableColumn } from "@ductura/ui";
import { useEffect, useState } from "react";

import { useHost } from "../../context";
import { healthMessages as t } from "./messages.hr";
import { readSystemHealth, type HealthState } from "./read";
import { healthRows, isDegraded, type HealthRow } from "./view";

const columns: DataTableColumn<HealthRow>[] = [
  { id: "label", header: t.measure, cell: (row) => row.label, rowHeader: true },
  { id: "value", header: t.value, cell: (row) => row.value },
];

/** F4-PM2-R16: the state of the server for the operator. States: loading, error with a retry, not ready, the facts. */
export default function HealthPage() {
  const { role } = useHost();
  const [view, setView] = useState<HealthState>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    void readSystemHealth().then((result) => { if (active) setView(result); });
    return () => { active = false; };
  }, [attempt]);

  return (
    <section className="page" data-role={role ?? undefined} data-e2="health">
      <h1>{t.title}</h1>
      <p>{t.lead}</p>
      {view.kind === "loading" && <Card title={t.serviceTitle} level={2} busy />}
      {view.kind === "unavailable" && (
        <>
          <Card title={t.serviceTitle} level={2} error={t.unavailable} />
          <Button onClick={() => { setView({ kind: "loading" }); setAttempt((n) => n + 1); }}>{t.retry}</Button>
        </>
      )}
      {view.kind === "ready" && (
        <>
          {view.data.notReady !== null && <p role="alert">{view.data.notReady === "draining" ? t.draining : t.notReady}</p>}
          {view.data.notReady === null && isDegraded(view.data) && <p role="status">{t.states.degraded}</p>}
          <Card title={t.readyTitle} level={2}>
            <DataTable caption={t.table} columns={columns} rows={healthRows(view.data)} rowKey={(row) => row.id} empty={t.unavailable} />
          </Card>
          <Button onClick={() => { setView({ kind: "loading" }); setAttempt((n) => n + 1); }}>{t.retry}</Button>
        </>
      )}
    </section>
  );
}
