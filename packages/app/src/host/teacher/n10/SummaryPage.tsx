"use client";

import { Button, Details, Tag } from "@ductura/ui";
import { useEffect, useState, type ReactNode } from "react";

import { goToSignIn } from "../../../../../../src/client/api";
import { Kv, WorkPage, WorkPanel, workPageStyles as styles } from "../n07/WorkPage";
import { useTaskCrumb, type WorkContext } from "../n06/task-context";
import {
  assistantAnchor, assistantTransfers, at, characters, charactersGenitive, duration, loadSummary, minutesGenitive, pasteAnchor,
  period, segmentLine, sessionLine, sessionsCount, sessionsGenitive, versionLines, type N10Port, type N10Read, type ThresholdRow,
  type ThresholdState,
} from "./model";
import { originText } from "../provenance/origin-messages.hr";
import type { OriginKind } from "../provenance/origin";
import ProvenanceMap from "../provenance/ProvenanceMap";
import { n10Messages as text } from "./messages.hr";

/** Scrolls to an anchor of the origin map and moves the focus there (prototype `act:jump`). */
function jump(id: string) {
  const target = document.getElementById(id);
  if (target === null) return;
  target.scrollIntoView({ block: "center" });
  target.setAttribute("tabindex", "-1");
  target.focus();
}

function Jump({ id, anchors }: { id: string; anchors: ReadonlySet<string> }) {
  if (!anchors.has(id)) return null;
  return <a href={`#${id}`} onClick={(event) => { event.preventDefault(); jump(id); }}>{text.jump}</a>;
}

const Observed = () => <Tag>{text.observed}</Tag>;
const Unavailable = () => <p className="meta">{text.unavailable}</p>;

/** `.sb-state` of the prototype's `summary()`: a ruled section whose heading row carries the "zabilježeno" tag. */
function Section({ title, observed = true, children }: { title: string; observed?: boolean; children: ReactNode }) {
  return (
    <section className={styles.state}>
      {observed ? <div className={styles.ev}><h2>{title}</h2><Observed /></div> : <h2>{title}</h2>}
      {children}
    </section>
  );
}

/** A listed item (`.item`): the line with its tag on the `.sb-ev` row, then the notes and the jump link. */
function Entry({ line, children }: { line: string; children: ReactNode }) {
  return <li className="item"><div className={styles.ev}><span>{line}</span><Observed /></div>{children}</li>;
}

const KIND_LABEL: Record<OriginKind, string> = {
  typed: originText.kindTyped,
  assistant_inserted: originText.kindAssistantInserted,
  assistant_match: originText.kindAssistantMatch,
  imported_file: originText.kindImportedFile,
  pasted_known: originText.kindPastedKnown,
  pasted_unknown: originText.kindPastedUnknown,
};
const STATE_LABEL: Record<ThresholdState, string> = { in_line: text.rulesInLine, for_review: text.rulesForReview, exceeded: text.rulesExceeded };

/** P-1 rule 12: one of three labels per kind, in the order of the closed list; no threshold, no number, no ranking. */
function FacultyRules({ rows }: { rows: readonly ThresholdRow[] }) {
  return (
    <Section title={text.rulesTitle} observed={false}>
      <p className="note">{text.rulesNotice}</p>
      <ul className="list" data-rules>{rows.map((row) => (
        <li key={row.origin} className="item" data-origin={row.origin}>
          <div className={styles.ev}><span>{KIND_LABEL[row.origin]}</span><Tag>{STATE_LABEL[row.state]}</Tag></div>
        </li>
      ))}</ul>
    </Section>
  );
}

function Sections({ read, anchors }: { read: Extract<N10Read, { kind: "ready" }>; anchors: ReadonlySet<string> }) {
  const { summary, details, versions } = read;
  const { sessions, pastes, gaps } = summary;
  const hasGaps = gaps.items.length > 0;
  const span = period(sessions.items);
  const versionList = versions === null ? null : versionLines(versions);
  const transfers = details === null ? null : assistantTransfers(details);
  return (
    <>
      <p className="meta">{text.intro}</p>
      <Section title={text.periodTitle}>
        {span === null ? <Unavailable /> : (
          <>
            <Kv label={text.periodFirst}>{at(span.from)}</Kv>
            <Kv label={text.periodLast}>{at(span.to)}</Kv>
          </>
        )}
      </Section>
      <Section title={text.sessionsTitle}>
        <Kv label={text.sessionsLabel}>{sessionsCount(sessions.count)}</Kv>
        <p className="meta">{text.sessionsMeta(minutesGenitive(sessions.breakAboveMinutes), hasGaps)}</p>
        <Details summary={text.sessionsList}>
          <ul className="facts">{sessions.items.map((s, i) => <li key={i}>{sessionLine(s)}</li>)}</ul>
        </Details>
      </Section>
      <Section title={text.activeTitle}>
        {details === null ? <Unavailable /> : <Kv label={text.activeLabel(sessionsGenitive(sessions.count))}>{duration(details.activeEditingMinutes)}</Kv>}
        <p className="note">{text.activeNote}</p>
      </Section>
      <Section title={text.versionsTitle}>
        {versionList === null ? <Unavailable /> : versionList.length === 0 ? <p className="meta">{text.versionsEmpty}</p>
          : <ul className="facts">{versionList.map((v) => <li key={v.revision}>{v.line}</li>)}</ul>}
      </Section>
      <Section title={text.pastesTitle} observed={false}>
        {pastes.listed.length === 0 ? <p className="meta">{text.pastesEmpty}</p> : (
          <ul className="list">{pastes.listed.map((p, i) => (
            <Entry key={i} line={`${segmentLine(p.at)} · ${characters(p.characters)}`}>
              <span className="note">{text.sourceNotObserved}</span>
              <Jump id={pasteAnchor(i)} anchors={anchors} />
            </Entry>
          ))}</ul>
        )}
        <p className="meta">{text.pastesMeta(charactersGenitive(pastes.listedAboveCharacters))}</p>
      </Section>
      <Section title={text.assistantTitle} observed={false}>
        {transfers === null ? <Unavailable /> : transfers.length === 0 ? <p className="meta">{text.assistantEmpty}</p> : (
          <ul className="list">{transfers.map((t, i) => (
            <Entry key={i} line={segmentLine(t)}>
              <span className="meta">{text.assistantDetailsMissing}</span>
              <Jump id={assistantAnchor(i)} anchors={anchors} />
            </Entry>
          ))}</ul>
        )}
        <p className="meta">{text.assistantNote}</p>
      </Section>
      <Section title={text.gapsTitle}>
        {hasGaps ? <ul className="facts">{gaps.items.map((g, i) => <li key={i}>{text.gap(at(g.previousEndedAt), at(g.nextStartedAt))}</li>)}</ul>
          : <p>{text.gapsNone}</p>}
      </Section>
      <Section title={text.notesTitle} observed={false}>
        <Unavailable />
      </Section>
      {read.thresholds === undefined ? null : <FacultyRules rows={read.thresholds} />}
      <Section title={text.stateTitle}>
        <p>{hasGaps ? text.stateGaps : text.stateComplete}</p>
        <p className="meta">{text.stateUnchanged}</p>
      </Section>
    </>
  );
}

/**
 * N-10 "Sažetak procesa" as its own page (WEB-2157): the summary on the left and, on the right, the origin map
 * (`map`, N-10 br. 18; not part of this task). "Prikaži mjesto u radu" is offered only for an anchor the map
 * reports in `anchors`. There is no role prop: the summary is the one the student sees (PRODUCT §5 rule 5).
 */
export default function SummaryPage({ port, documentId, workHref, signInHref, map, anchors = new Set(), task }: {
  port: N10Port; documentId: string; workHref: string; signInHref: string; map?: ReactNode; anchors?: ReadonlySet<string>;
  task?: (documentId: string) => Promise<WorkContext | null>;
}) {
  // F4-NAS-R12: the student, the kind of work and the assignment's title above the summary.
  const crumb = useTaskCrumb(documentId, task);
  const [read, setRead] = useState<N10Read | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let live = true;
    setRead(null);
    void loadSummary(port, documentId).then((next) => {
      if (!live) return;
      if (next.kind === "signedOut") goToSignIn(signInHref);
      setRead(next);
    });
    return () => { live = false; };
  }, [port, documentId, attempt, signInHref]);

  let body: ReactNode;
  let two = false;
  if (read === null || read.kind === "signedOut") {
    body = <WorkPanel id="pg-h" title={text.title} busy><p className="note" role="status">{text.loading}</p><div className="skel w80" /><div className="skel w60" /><div className="skel w40" /></WorkPanel>;
  } else if (read.kind === "unavailable") {
    body = (
      <WorkPanel id="pg-h" title={text.title}>
        <p className="note" role="alert">{text.error}</p>
        <div className={styles.acts}><Button tone="secondary" onClick={() => setAttempt((n) => n + 1)}>{text.retry}</Button></div>
      </WorkPanel>
    );
  } else if (read.kind === "notFound") body = <WorkPanel id="pg-h" title={text.title}><p className="note" role="alert">{text.notFound}</p></WorkPanel>;
  else if (read.kind === "empty") body = <WorkPanel id="pg-h" title={text.title}><p className="note">{text.empty}</p></WorkPanel>;
  else {
    two = true;
    body = (
      <>
        <WorkPanel id="sm-h" title={text.title} stick={two}><Sections read={read} anchors={anchors} /></WorkPanel>
        {map ?? <ProvenanceMap documentId={documentId} />}
      </>
    );
  }
  return <WorkPage back={workHref} backLabel={text.backToWork} crumb={crumb} two={two}>{body}</WorkPage>;
}
