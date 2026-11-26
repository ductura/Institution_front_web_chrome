"use client";

import { Button, DataTable, Select, type DataTableColumn } from "@ductura/ui";
import { useCallback, useEffect, useRef, useState } from "react";

import { appHref } from "@/components/index";
import { createApi, goToSignIn } from "@/client/api";

import { useHost } from "../../context";
import { CommitteeEditor } from "../../thesis/committee/CommitteeEditor";
import { readCommittee, type CommitteeMember } from "../../thesis/committee/read";
import { thesisOverviewMessages as t } from "./messages.hr";
import { STAGES, appendPage, asStageFilter, nameText, pluralMembers, type StageFilter, type ThesisRow } from "./model";
import { readOverview } from "./read";

const date = new Intl.DateTimeFormat("hr-HR", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Zagreb" });
const defenseText = (iso: string | null) => (iso === null ? t.noDefense : date.format(new Date(iso)));

type Status = "loading" | "ready" | "signedOut" | "denied" | "unavailable";
type Open = { documentId: string; student: string; read: { kind: "loading" } | { kind: "ready"; members: readonly CommitteeMember[] } | { kind: "notFound" | "unavailable" } };

/**
 * WEB-V16-POPIS-FAKULTET: the administrator's read-only list of theses over institution.thesis-overview.get. The filter
 * sends only an allowed phase; "Učitaj još" follows the server's `next` cursor, so every work is reachable. A row with a
 * work opens CommitteeEditor. There is no grade column and no rank.
 */
export default function ThesisOverviewPage() {
  const { base } = useHost();
  const [filter, setFilter] = useState<StageFilter>("");
  const [rows, setRows] = useState<readonly ThesisRow[]>([]);
  const [next, setNext] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [more, setMore] = useState<"idle" | "busy" | "failed">("idle");
  const [attempt, setAttempt] = useState(0);
  const [open, setOpen] = useState<Open | null>(null);
  const ticket = useRef(0);

  useEffect(() => {
    const mine = ++ticket.current;
    setStatus("loading"); setRows([]); setNext(null); setMore("idle"); setOpen(null);
    void readOverview(filter, null).then((r) => {
      if (mine !== ticket.current) return;
      if (r.kind === "ready") { setRows(r.page.works); setNext(r.page.next); setStatus("ready"); } else setStatus(r.kind);
    });
  }, [filter, attempt]);
  useEffect(() => {
    if (status === "signedOut") goToSignIn(appHref(base, "/ustanova/zavrsni-radovi"));
  }, [status, base]);

  const loadMore = async () => {
    if (next === null || more === "busy") return;
    const mine = ticket.current;
    setMore("busy");
    const r = await readOverview(filter, next);
    if (mine !== ticket.current) return;
    if (r.kind === "ready") { setRows((shown) => appendPage(shown, r.page)); setNext(r.page.next); setMore("idle"); }
    else if (r.kind === "signedOut" || r.kind === "denied") setStatus(r.kind);
    else setMore("failed");
  };

  const openCommittee = useCallback(async (row: ThesisRow) => {
    if (row.documentId === null) return;
    const documentId = row.documentId;
    const student = nameText(row.studentName, t.unnamed);
    setOpen({ documentId, student, read: { kind: "loading" } });
    const r = await readCommittee(createApi(), documentId);
    setOpen((now) => {
      if (now === null || now.documentId !== documentId) return now;
      return { ...now, read: r.kind === "ready" ? { kind: "ready", members: r.value.members } : r.kind === "notFound" ? { kind: "notFound" } : { kind: "unavailable" } };
    });
  }, []);

  const columns: DataTableColumn<ThesisRow>[] = [
    { id: "type", header: t.colType, cell: (r) => t.workTypes[r.workType] },
    { id: "student", header: t.colStudent, cell: (r) => nameText(r.studentName, t.unnamed), rowHeader: true },
    { id: "mentor", header: t.colMentor, cell: (r) => nameText(r.mentorName, t.unnamed) },
    { id: "stage", header: t.colStage, cell: (r) => t.stages[r.stage] },
    { id: "defense", header: t.colDefense, cell: (r) => defenseText(r.defenseAt) },
    { id: "topic", header: t.colTopic, cell: (r) => t.topics[r.topicState] },
    { id: "committee", header: t.colCommittee, cell: (r) => (r.committeeSize === 0 ? t.committeeNone : pluralMembers(r.committeeSize, t.committeeCount)) },
    {
      id: "action", header: t.colAction,
      cell: (r) => r.documentId === null ? t.noDocument : (
        <Button tone="secondary" aria-label={t.openCommitteeFor.replace("{student}", nameText(r.studentName, t.unnamed))} onClick={() => void openCommittee(r)}>{t.openCommittee}</Button>
      ),
    },
  ];

  if (status === "signedOut") return <p role="alert">{t.signedOut}</p>;
  if (status === "denied") return <p role="alert">{t.denied}</p>;

  return (
    <>
      <p>{t.lead}</p>
      <Select
        label={t.filterLabel} name="stage" value={filter} placeholder={t.filterAll}
        onChange={(e) => setFilter(asStageFilter(e.target.value))}
        options={STAGES.map((s) => ({ value: s, label: t.stages[s] }))}
      />
      {status === "loading" && <p role="status">{t.loading}</p>}
      {status === "unavailable" && (
        <div>
          <p role="alert">{t.unavailable}</p>
          <Button onClick={() => setAttempt((n) => n + 1)}>{t.retry}</Button>
        </div>
      )}
      {status === "ready" && (
        <>
          <DataTable
            caption={t.caption} columns={columns} rows={rows}
            rowKey={(r) => r.documentId ?? `${r.workType}:${r.studentName?.familyName ?? ""}:${r.defenseAt ?? ""}:${rows.indexOf(r)}`}
            empty={filter === "" ? t.emptyAll : t.empty}
          />
          {more === "failed" && <p role="alert">{t.moreUnavailable}</p>}
          {next !== null && <Button tone="secondary" busy={more === "busy"} onClick={() => void loadMore()}>{more === "busy" ? t.loadingMore : t.loadMore}</Button>}
        </>
      )}
      {open !== null && (
        <section aria-label={t.committeeHeading}>
          <h2>{t.committeeHeading}: {open.student}</h2>
          {open.read.kind === "loading" && <p role="status">{t.committeeLoading}</p>}
          {open.read.kind === "notFound" && <p role="alert">{t.committeeNotFound}</p>}
          {open.read.kind === "unavailable" && <p role="alert">{t.committeeUnavailable}</p>}
          {open.read.kind === "ready" && (
            <CommitteeEditor
              key={open.documentId} documentId={open.documentId} value={open.read.members}
              onSaved={(members) => setRows((shown) => shown.map((r) => (r.documentId === open.documentId ? { ...r, committeeSize: members.length } : r)))}
              onNotFound={() => setOpen(null)}
            />
          )}
          <Button tone="secondary" onClick={() => setOpen(null)}>{t.closeCommittee}</Button>
        </section>
      )}
    </>
  );
}
