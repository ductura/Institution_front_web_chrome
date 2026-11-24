"use client";

import { Card, DataTable, Tag, type DataTableColumn } from "@ductura/ui";

import { useHost } from "../../context";
import { problemReportsMessages as t } from "./messages.hr";
import { routingFor, viewerOf, type RoutingRow } from "./routing";

const columns: DataTableColumn<RoutingRow>[] = [
  { id: "category", header: t.category, cell: (row) => row.label, rowHeader: true },
  { id: "handler", header: t.handler, cell: (row) => (row.yours ? <>{row.handler} <Tag>{t.yours}</Tag></> : row.handler) },
];

/**
 * NF-7 OA-7: the problem reports for the operator and the faculty's administrator. The contract
 * extract has only the sending of a report, not a read of the reports or their state, so the page
 * shows the honest "not yet available" state and who handles which category; it reads nothing
 * from the server and never shows invented reports. The host lets only these two accounts in.
 */
export default function ProblemReportsPage() {
  const { role } = useHost();
  return (
    <section className="page" data-role={role ?? undefined} data-nf7="OA-7">
      <h1>{t.title}</h1>
      <p>{t.lead}</p>
      <Card title={t.unavailableTitle} level={2} center empty={t.unavailableBody} />
      <Card title={t.routingTitle} level={2}>
        <DataTable caption={t.routingCaption} columns={columns} rows={routingFor(viewerOf(role))} rowKey={(row) => row.category} empty="" />
        <p>{t.states}</p>
        <p>{t.privacy}</p>
      </Card>
    </section>
  );
}
