"use client";

import { Button, DataTable, Select, formatDateTime, type DataTableColumn } from "@ductura/ui";
import { useCallback, useEffect, useRef, useState } from "react";

import { appHref, homeHref } from "@/components/index";
import { createApi, goToSignIn } from "@/client/api";

import { messagesHr as app } from "../../../../../../locales/hr.ts";
import { useHost } from "../../context";
import { DeniedState, LoadAlert } from "../../states/States";
import { CommitteeEditor } from "../../thesis/committee/CommitteeEditor";
import { readCommittee, type CommitteeMember } from "../../thesis/committee/read";
import { thesisOverviewMessages as t } from "./messages.hr";
import { STAGES, appendPage, asStageFilter, nameText, pluralMembers, type StageFilter, type ThesisRow } from "./model";
import { readOverview } from "./read";

// "14. prosinca 2026. u 10:30": the full month, Zagreb time (A3).
const defenseText = (iso: string | null) => (iso === null ? t.noDefense : formatDateTime(iso, "hr"));

type Status = "loading" | "ready" | "signedOut" | "denied" | "unavailable";
type Open = { documentId: string; student: string; read: { kind: "loading" } | { kind: "ready"; members: readonly CommitteeMember[] } | { kind: "notFound" | "unavailable" } };

/**
 * WEB-V16-POPIS-FAKULTET: the administrator's read-only list of theses over institution.thesis-overview.get. The filter
 * sends only an allowed phase; "Učitaj još" follows the server's `next` cursor, so every work is reachable. A row with a
 * work opens CommitteeEditor. There is no grade column and no rank.
 */
export default function ThesisOverviewPage({ title = t.title }: { title?: string }) {
  const { base, role } = useHost();
  const [filter, setFilter] = useState<StageFilter>("");
  const [rows, setRows] = useState<readonly ThesisRow[]>([]);
  const [next, setNext] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [more, setMore] = useState<"idle" | "busy" | "failed">("idle");
  const [attempt, setAttempt] = useState(0);
  const [open, setOpen] = useState<Open | null>(null);
  const ticket = useRef(0);
  const heading = useRef<HTMLHeadingElement | null>(null);
  const openers = useRef(new Map<string, HTMLButtonElement>());
  // The row whose "Povjerenstvo" button had the focus when the section opened: "Zatvori" gives it back.
  const returnTo = useRef<string | null>(null);

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

  const readOpen = useCallback(async (documentId: string) => {
    const r = await readCommittee(createApi(), documentId);
    setOpen((now) => {
      if (now === null || now.documentId !== documentId) return now;
      return { ...now, read: r.kind === "ready" ? { kind: "ready", members: r.value.members } : r.kind === "notFound" ? { kind: "notFound" } : { kind: "unavailable" } };
    });
  }, []);

  const openCommittee = useCallback(async (row: ThesisRow) => {
    if (row.documentId === null) return;
    const documentId = row.documentId;
    returnTo.current = documentId;
    setOpen({ documentId, student: nameText(row.studentName, t.unnamed), read: { kind: "loading" } });
    await readOpen(documentId);
  }, [readOpen]);

  // Opening the committee moves the focus to its heading and brings the section into view.
  const openedId = open?.documentId ?? null;
  useEffect(() => {
    if (openedId === null) return;
    heading.current?.focus();
    heading.current?.scrollIntoView?.({ block: "start" });
  }, [openedId]);

  const closeCommittee = () => {
    const back = returnTo.current;
    setOpen(null);
    // The button of that row is still in the table; the focus goes back to it once the section is gone.
    if (back !== null) queueMicrotask(() => openers.current.get(back)?.focus());
  };

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
        <Button
          tone="secondary" aria-label={t.openCommitteeFor.replace("{student}", nameText(r.studentName, t.unnamed))}
          ref={(el) => { if (el === null) openers.current.delete(r.documentId!); else openers.current.set(r.documentId!, el); }}
          onClick={() => void openCommittee(r)}
        >{t.openCommittee}</Button>
      ),
    },
  ];

  // 401 goes to sign-in without any text on the page; 403 is "Nemate pristup ovom prikazu" and the way back (A5).
  if (status === "signedOut") return null;
  if (status === "denied") {
    return <DeniedState title={app.access.deniedTitle} backLabel={app.access.backToOwn} backHref={appHref(base, homeHref(role))} />;
  }

  return (
    <>
      <h1>{title}</h1>
      <p>{t.lead}</p>
      <Select
        label={t.filterLabel} name="stage" value={filter} placeholder={t.filterAll}
        onChange={(e) => setFilter(asStageFilter(e.target.value))}
        options={STAGES.map((s) => ({ value: s, label: t.stages[s] }))}
      />
      {status === "loading" && <p role="status">{t.loading}</p>}
      {status === "unavailable" && <LoadAlert body={t.unavailable} retry={{ label: t.retry, onRetry: () => setAttempt((n) => n + 1) }} />}
      {status === "ready" && (
        <>
          <DataTable
            caption={t.caption} columns={columns} rows={rows}
            rowKey={(r) => r.documentId ?? `${r.workType}:${r.studentName?.familyName ?? ""}:${r.defenseAt ?? ""}:${rows.indexOf(r)}`}
            empty={filter === "" ? t.emptyAll : t.empty}
          />
          {/* No link: "Učitaj još" below asks again. */}
          {more === "failed" && <LoadAlert body={t.moreUnavailable} />}
          {next !== null && <Button tone="secondary" busy={more === "busy"} onClick={() => void loadMore()}>{more === "busy" ? t.loadingMore : t.loadMore}</Button>}
        </>
      )}
      {open !== null && (
        <section aria-label={t.committeeHeading}>
          <h2 ref={heading} tabIndex={-1}>{t.committeeHeading}: {open.student}</h2>
          {open.read.kind === "loading" && <p role="status">{t.committeeLoading}</p>}
          {open.read.kind === "notFound" && <LoadAlert body={t.committeeNotFound} />}
          {open.read.kind === "unavailable" && (
            <LoadAlert
              body={t.committeeUnavailable}
              retry={{ label: t.retry, onRetry: () => { const id = open.documentId; setOpen((now) => (now === null ? now : { ...now, read: { kind: "loading" } })); void readOpen(id); } }}
            />
          )}
          {open.read.kind === "ready" && (
            <CommitteeEditor
              key={open.documentId} documentId={open.documentId} value={open.read.members}
              onSaved={(members) => setRows((shown) => shown.map((r) => (r.documentId === open.documentId ? { ...r, committeeSize: members.length } : r)))}
              onNotFound={() => { const closing = open.documentId; setOpen((now) => (now !== null && now.documentId === closing ? null : now)); }}
            />
          )}
          <Button tone="secondary" onClick={closeCommittee}>{t.closeCommittee}</Button>
        </section>
      )}
    </>
  );
}
