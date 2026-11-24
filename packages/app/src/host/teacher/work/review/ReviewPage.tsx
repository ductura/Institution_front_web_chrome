"use client";

import { Button, PanelTabs, Skeleton, type PanelTab } from "@ductura/ui";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { flushSync } from "react-dom";

import type { DeclarationPort } from "../../../../../../../src/client/declaration";
import { formatDateTimeHr } from "../../../../../../../src/lib/i18n/hr";
import { appHref } from "@/components/shell/nav";
import { liveWorkHref } from "@/components/teacher/LiveWorkFrame";
import { useHost } from "../../../context";
import AiDeclarationSection from "../../ai-declaration/AiDeclarationSection";
import MobileReview from "../../mobile-review/MobileReview";
import { WorkPage } from "../../n07/WorkPage";
import type { MatchCall } from "../../provenance/contract";
import ProvenanceMap from "../../provenance/ProvenanceMap";
import type { ProvenanceCall } from "../../provenance/read";
import { isSubmitted } from "../../n06/model";
import ProcessOverview from "./ProcessOverview";
import { realExtras, type ReviewExtras } from "./extras";
import ExportPanel, { type ExportDeps } from "./ExportPanel";
import { exportMessages as x } from "./export-messages.hr";
import { Composition, Given, Notes, Places } from "./PgSections";
import styles from "./review.module.css";
import { contextLine, DEFAULT_TAB, gradeNote, headingOf, reviewPath, stateOf, tabOf, taskPath, type TabId } from "./model";
import { reviewReads, type HeaderRead, type ReviewReads } from "./read";
import { reviewMessages as t } from "./messages.hr";

const ALWAYS = (): boolean => true;
const firstTab = (): TabId => (typeof window === "undefined" ? DEFAULT_TAB : tabOf(window.location.search));

/** PG-11: the time of the print, set just before the browser prints (the button or the browser's own print). */
function usePrintedAt(now: () => Date): string | null {
  const [at, setAt] = useState<string | null>(null);
  useEffect(() => {
    const before = () => flushSync(() => setAt(formatDateTimeHr(now().toISOString())));
    window.addEventListener("beforeprint", before);
    return () => window.removeEventListener("beforeprint", before);
  }, [now]);
  return at;
}

const NOW = (): Date => new Date();

/**
 * "Pregled rada" (WEB-NUZ-PG; NF-5 PG-1, PG-4, PG-10; prototype screen `pregled`): one place for one work. The
 * header names the course, the assignment, the kind of work, the deadline and the state of the submission; below
 * it the views of the work are tabs. The open tab is kept in the address, so "Prethodni/Sljedeći rad" open the
 * other work on the same tab. Read only: nothing here writes, and no mark goes into a grade (the grade is in Merlin and Studomat).
 */
export default function ReviewPage({ documentId, current = ALWAYS, reads: given, matchCall, provenanceCall, declarationPort, extras = realExtras, exportDeps }: {
  documentId: string; current?: () => boolean; reads?: ReviewReads; matchCall?: MatchCall;
  provenanceCall?: ProvenanceCall; declarationPort?: DeclarationPort; extras?: ReviewExtras; exportDeps?: ExportDeps;
}) {
  const { base } = useHost();
  const reads = useMemo(() => given ?? reviewReads(current), [given, current]);
  const [read, setRead] = useState<HeaderRead | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [tab, setTab] = useState<TabId>(firstTab);
  const printedAt = usePrintedAt(exportDeps?.now ?? NOW);
  useEffect(() => {
    let live = true;
    setRead(null);
    void reads.header(documentId).then((next) => { if (live) setRead(next); });
    return () => { live = false; };
  }, [reads, documentId, attempt]);

  const workPath = liveWorkHref(documentId) ?? "";
  const workHref = appHref(base, workPath);
  const coursesHref = appHref(base, "/nastavnik/kolegiji");
  const changeTab = (id: string) => {
    const next = tabOf(`?kartica=${id}`);
    setTab(next);
    try { window.history.replaceState(window.history.state, "", appHref(base, reviewPath(workPath, next))); } catch { /* the tab still opens */ }
  };

  if (read === null) return <WorkPage back={coursesHref} backLabel={t.backToCourses}><Skeleton label={t.loading} /></WorkPage>;
  if (read.kind !== "ready") {
    return (
      <WorkPage back={coursesHref} backLabel={t.backToCourses}>
        <h1>{t.title}</h1>
        {read.kind === "unavailable" ? <>
          <p role="alert">{t.error}</p>
          <Button onClick={() => setAttempt((n) => n + 1)}>{t.retry}</Button>
        </> : <p role="alert">{read.kind === "notFound" ? t.notFound : t.signedOut}</p>}
      </WorkPage>
    );
  }

  const { header } = read;
  const grade = gradeNote(header.grade);
  const submitted = isSubmitted(header.facts);
  const step = (id: string | null, label: string, rel: "prev" | "next") => {
    const path = liveWorkHref(id);
    return path === null ? <span aria-disabled="true" className="btn secondary">{label}</span>
      : <a href={appHref(base, reviewPath(path, tab))} rel={rel} className="btn secondary" data-step={rel}>{label}</a>;
  };
  const view = (title: string, body: ReactNode) => <section aria-label={title}><h2>{title}</h2>{body}</section>;
  const tabs: readonly PanelTab[] = [
    { id: "tekst", label: t.tabText, content: view(t.tabText, <>
      <p className="note">{t.textNote}</p>
      <p><a href={workHref}>{t.textOpen}</a></p>
      <Given documentId={documentId} extras={extras} />
    </>) },
    { id: "sazetak", label: t.tabSummary, content: view(t.tabSummary,
      <ProcessOverview documentId={documentId} reads={reads} matchCall={matchCall} summaryHref={`${workHref}/sazetak`}
        declarationHref={appHref(base, reviewPath(workPath, "izjava"))} />) },
    { id: "podrijetlo", label: t.tabOrigin, content: <>
      <ProvenanceMap documentId={documentId} call={provenanceCall} matchCall={matchCall} />
      <Composition documentId={documentId} extras={extras} />
      <Notes documentId={documentId} extras={extras} />
    </> },
    { id: "reprodukcija", label: t.tabReplay, content: view(t.tabReplay, <>
      <p className="note">{t.replayNote}</p>
      <p><a href={`${workHref}/reprodukcija`}>{t.replayOpen}</a></p>
      <Places documentId={documentId} reads={reads} replayHref={`${workHref}/reprodukcija`} />
    </>) },
    { id: "usporedba", label: t.tabCompare, content: view(t.tabCompare, submitted ? <>
      <p className="note">{t.compareNote}</p>
      <p><a href={`${workHref}/usporedba`}>{t.compareOpen}</a></p>
    </> : <p className="note">{t.compareNotSubmitted}</p>) },
    { id: "izjava", label: t.tabDeclaration, content: <AiDeclarationSection submissionId={documentId} port={declarationPort} /> },
  ];

  // PG-12: on a phone the review keeps to the screen with 44 px controls; PG-11: on paper every view, one under the other.
  return (
    <MobileReview label={x.region} touch="large">
      <div className={styles.review} data-review-print>
        <WorkPage back={appHref(base, taskPath(header.facts.assignmentId))} backLabel={t.backToTask} crumb={headingOf(header)} wide>
          <section className="panel" aria-labelledby="pg-h" data-review-head>
            <p className="meta" data-review-context>{contextLine(header)}</p>
            <h1 id="pg-h">{headingOf(header)}</h1>
            <p data-review-state>{stateOf(header)}</p>
            <p className="note" data-review-grade><b>{grade.strong}</b> {grade.note}</p>
            {printedAt !== null && <div className={styles.printOnly} data-print-only>
              <p className="meta">{x.printedAt(printedAt)}</p>
              <p className="note">{x.printNotProof}</p>
            </div>}
            <nav aria-label={t.steps}>
              {step(header.facts.previousId, t.prev, "prev")} {step(header.facts.nextId, t.next, "next")}
            </nav>
            <p className="meta" data-print-hide>{t.stepsNote}</p>
          </section>
          <ExportPanel assignmentId={header.facts.assignmentId} documentId={documentId} student={header.facts.studentName}
            grade={header.grade} deps={exportDeps} />
          <PanelTabs label={t.tabsLabel} tabs={tabs} initial={tab} onChange={changeTab} />
        </WorkPage>
      </div>
    </MobileReview>
  );
}
