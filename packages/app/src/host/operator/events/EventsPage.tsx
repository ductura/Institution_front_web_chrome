"use client";

import { Button, Card, DataTable, TextField, type DataTableColumn } from "@ductura/ui";
import { useEffect, useState } from "react";

import { useHost } from "../../context";
import { eventsMessages as t } from "./messages.hr";
import { readEvents, type EventsPage as Page, type EventsState, type SystemEvent } from "./read";
import { visibleEvents } from "./view";

const date = new Intl.DateTimeFormat("hr-HR", { dateStyle: "medium", timeStyle: "medium", timeZone: "Europe/Zagreb" });
const columns: DataTableColumn<SystemEvent>[] = [
  { id: "at", header: t.time, cell: (row) => <time dateTime={row.at}>{date.format(new Date(row.at))}</time>, rowHeader: true },
  { id: "kind", header: t.kind, cell: (row) => row.kind },
  { id: "account", header: t.account, cell: (row) => row.accountKind ?? t.noAccount },
];

/** F4-PM2-R16: the system's events for the operator. States: loading, empty, error with a retry, no authority (401/403). */
export default function EventsPage() {
  const { role } = useHost();
  const [view, setView] = useState<EventsState>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [prefix, setPrefix] = useState("");
  const [moreFailed, setMoreFailed] = useState(false);
  useEffect(() => {
    let active = true;
    void readEvents().then((result) => { if (active) setView(result); });
    return () => { active = false; };
  }, [attempt]);

  async function older(current: Page) {
    if (current.next === null) return;
    setMoreFailed(false);
    const result = await readEvents({ after: current.next });
    if (result.kind !== "ready") { setMoreFailed(true); return; }
    setView({ kind: "ready", data: { events: [...current.events, ...result.data.events], next: result.data.next } });
  }

  return (
    <section className="page" data-role={role ?? undefined} data-e2="events">
      <h1>{t.title}</h1>
      <p>{t.lead}</p>
      {view.kind === "loading" && <Card title={t.eventsTitle} level={2} busy />}
      {view.kind === "denied" && <Card title={t.eventsTitle} level={2} error={t.denied} />}
      {view.kind === "unavailable" && (
        <>
          <Card title={t.eventsTitle} level={2} error={t.unavailable} />
          <Button onClick={() => { setView({ kind: "loading" }); setAttempt((n) => n + 1); }}>{t.retry}</Button>
        </>
      )}
      {view.kind === "ready" && view.data.events.length === 0 && <Card title={t.emptyTitle} level={2} center empty={t.emptyBody} />}
      {view.kind === "ready" && view.data.events.length > 0 && (
        <>
          <TextField label={t.filter} hint={t.filterHint} value={prefix} onChange={(e) => setPrefix(e.target.value)} />
          <DataTable caption={t.table} columns={columns} rows={visibleEvents(view.data.events, prefix)} rowKey={(row) => String(row.seq)} empty={t.noMatch} />
          {moreFailed && <p role="alert">{t.moreFailed}</p>}
          {view.data.next !== null && <Button tone="secondary" onClick={() => void older(view.data)}>{t.more}</Button>}
        </>
      )}
    </section>
  );
}
