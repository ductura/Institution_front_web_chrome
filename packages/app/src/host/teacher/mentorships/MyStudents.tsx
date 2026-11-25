"use client";

import { useEffect, useMemo, useState } from "react";
import { Button, Card, DataTable, Select, Tag, type DataTableColumn } from "@ductura/ui";

import { messagesHr } from "../../../../../../locales/hr";
import type { MentoredWork, MentoredWorkType } from "../../../../../../src/components/teacher/mentored-works-read";
import { appHref } from "../../../../../../src/components/shell/nav";
import { overviewText as t } from "./messages.hr";
import { ofType, overviewRows, readOutcome, type OverviewRow, type WorkProgress } from "./overview-model";
import { readOverview, type OverviewCall } from "./overview-read";

const TYPES: readonly MentoredWorkType[] = ["bachelor_thesis", "master_thesis", "specialist_thesis", "doctoral_thesis"];
const typeText: Record<string, string> = messagesHr.teacher.assignment.workTypes;

/**
 * NF-6 MK-11: "Moji studenti" on N-16, under the works list. A table (caption, column headers, the student
 * as the row header) of "Student i rad / Etapa / Stanje", "čeka Vas" first. It reads on its own: while it
 * loads or when it fails the works list above stays, and a failure says so with a retry. `now` is for tests.
 */
export function MyStudents({ works, call, base, now = Date.now }:
  { works: readonly MentoredWork[]; call: () => OverviewCall; base: string; now?: () => number }) {
  const [progress, setProgress] = useState<ReadonlyMap<string, WorkProgress> | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [type, setType] = useState<MentoredWorkType | "">("");

  useEffect(() => {
    let live = true;
    setProgress(null);
    void readOverview(call(), works).then((next) => { if (live) setProgress(next); });
    return () => { live = false; };
    // `call` is stable per mount; the attempt is what reads again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [works, attempt]);

  const rows = useMemo(() => (progress === null ? [] : overviewRows(works, progress, now())), [works, progress, now]);
  if (works.length === 0) return null;

  const outcome = progress === null ? "ok" : readOutcome(progress);
  const retry = <Button tone="quiet" onClick={() => setAttempt((n) => n + 1)}>{t.retry}</Button>;
  const columns: DataTableColumn<OverviewRow>[] = [
    { id: "work", header: t.colWork, rowHeader: true, cell: ({ href, name, workType, title }) => (
      <>{href === null ? name : <a href={appHref(base, href)}>{name}</a>}<br /><span className="meta">{`${typeText[workType] ?? ""} „${title}”`}</span></>
    ) },
    { id: "stage", header: t.colStage, cell: (r) => r.stage },
    { id: "state", header: t.colState, cell: (r) => (r.standing === "yours" ? <Tag tone="accent">{r.state}</Tag> : r.state) },
  ];

  return (
    <div data-testid="my-students" data-state={progress === null ? "loading" : outcome}>
      <Card level={2} title={t.title} busy={progress === null}
        error={outcome === "none" ? t.unavailable : outcome === "signedOut" ? t.signedOut : undefined}>
        <p className="note">{t.lead}</p>
        {outcome === "partly" && <p role="status">{t.partly} {retry}</p>}
        <Select label={t.filter} value={type} options={[{ value: "", label: t.filterAll }, ...TYPES.map((value) => ({ value, label: typeText[value] ?? value }))]}
          onChange={(event) => setType(event.currentTarget.value as MentoredWorkType | "")} />
        <DataTable caption={t.caption} columns={columns} rows={ofType(rows, type)} rowKey={(r) => r.key} empty={t.emptyFilter} />
      </Card>
      {outcome === "none" && <p>{retry}</p>}
    </div>
  );
}
