"use client";

import { Card, DataTable, type DataTableColumn } from "@ductura/ui";

import { useHost } from "../../context";
import { actionLogMessages as t } from "./messages.hr";

type Kind = (typeof t.kinds)[number];
const columns: DataTableColumn<Kind>[] = [
  { id: "kind", header: t.kind, cell: (row) => row.label, rowHeader: true },
  { id: "who", header: t.who, cell: (row) => row.who },
];

/**
 * NF-7 OA-3: the log of the administrators' and operators' actions, read only. The contract
 * extract has no read of it yet (SRV-ADMIN-3), so the page shows the honest "not yet available"
 * state and what the log will hold; it reads nothing and never shows invented actions. The host
 * lets only the operator's and the administrator's accounts in.
 */
export default function ActionLogPage() {
  const { role } = useHost();
  return (
    <section className="page" data-role={role ?? undefined} data-nf7="OA-3">
      <h1>{t.title}</h1>
      <p>{t.lead}</p>
      <Card title={t.unavailableTitle} level={2} center empty={t.unavailableBody} />
      <Card title={t.kindsTitle} level={2}>
        <DataTable caption={t.kindsCaption} columns={columns} rows={t.kinds} rowKey={(row) => row.id} empty="" />
        <p>{t.privacy}</p>
      </Card>
    </section>
  );
}
