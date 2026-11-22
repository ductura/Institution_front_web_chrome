"use client";

import { Button, Card, Details, KeyValueList, Skeleton, Tag } from "@ductura/ui";
import { useEffect, useState, type ReactNode } from "react";

import { goToSignIn } from "../../../../../../src/client/api";
import styles from "../../../../../../src/components/teacher/LiveWorkView.module.css";
import {
  assistantAnchor, assistantTransfers, at, characters, charactersGenitive, duration, loadSummary, minutesGenitive, pasteAnchor,
  period, segmentLine, sessionLine, sessionsCount, sessionsGenitive, versionLines, type N10Port, type N10Read,
} from "./model";
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
  return <Button tone="quiet" onClick={() => jump(id)}>{text.jump}</Button>;
}

const Observed = () => <Tag>{text.observed}</Tag>;
const Unavailable = () => <p className="meta">{text.unavailable}</p>;

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
      <Card title={text.periodTitle}>
        <Observed />
        {span === null ? <Unavailable /> : <KeyValueList items={[
          { id: "first", label: text.periodFirst, value: at(span.from) },
          { id: "last", label: text.periodLast, value: at(span.to) },
        ]} />}
      </Card>
      <Card title={text.sessionsTitle}>
        <Observed />
        <KeyValueList items={[{ id: "count", label: text.sessionsLabel, value: sessionsCount(sessions.count) }]} />
        <p className="meta">{text.sessionsMeta(minutesGenitive(sessions.breakAboveMinutes), hasGaps)}</p>
        <Details summary={text.sessionsList}>
          <ul className="facts">{sessions.items.map((s, i) => <li key={i}>{sessionLine(s)}</li>)}</ul>
        </Details>
      </Card>
      <Card title={text.activeTitle}>
        <Observed />
        {details === null ? <Unavailable /> : (
          <KeyValueList items={[{ id: "sum", label: text.activeLabel(sessionsGenitive(sessions.count)), value: duration(details.activeEditingMinutes) }]} />
        )}
        <p className="note">{text.activeNote}</p>
      </Card>
      <Card title={text.versionsTitle}>
        <Observed />
        {versionList === null ? <Unavailable /> : versionList.length === 0 ? <p className="meta">{text.versionsEmpty}</p>
          : <ul className="facts">{versionList.map((v) => <li key={v.revision}>{v.line}</li>)}</ul>}
      </Card>
      <Card title={text.pastesTitle}>
        {pastes.listed.length === 0 ? <p className="meta">{text.pastesEmpty}</p> : (
          <ul className="list">{pastes.listed.map((p, i) => (
            <li key={i} className="item">
              <span>{`${segmentLine(p.at)} · ${characters(p.characters)}`}</span> <Observed />
              <p className="note">{text.sourceNotObserved}</p>
              <Jump id={pasteAnchor(i)} anchors={anchors} />
            </li>
          ))}</ul>
        )}
        <p className="meta">{text.pastesMeta(charactersGenitive(pastes.listedAboveCharacters))}</p>
      </Card>
      <Card title={text.assistantTitle}>
        {transfers === null ? <Unavailable /> : transfers.length === 0 ? <p className="meta">{text.assistantEmpty}</p> : (
          <ul className="list">{transfers.map((t, i) => (
            <li key={i} className="item">
              <span>{segmentLine(t)}</span> <Observed />
              <p className="meta">{text.assistantDetailsMissing}</p>
              <Jump id={assistantAnchor(i)} anchors={anchors} />
            </li>
          ))}</ul>
        )}
        <p className="meta">{text.assistantNote}</p>
      </Card>
      <Card title={text.gapsTitle}>
        <Observed />
        {hasGaps ? <ul className="facts">{gaps.items.map((g, i) => <li key={i}>{text.gap(at(g.previousEndedAt), at(g.nextStartedAt))}</li>)}</ul>
          : <p>{text.gapsNone}</p>}
      </Card>
      <Card title={text.notesTitle}>
        <Unavailable />
      </Card>
      <Card title={text.stateTitle}>
        <Observed />
        <p>{hasGaps ? text.stateGaps : text.stateComplete}</p>
        <p className="meta">{text.stateUnchanged}</p>
      </Card>
    </>
  );
}

/**
 * N-10 "Sažetak procesa" as its own page (WEB-2157): the summary on the left and, on the right, the origin map
 * (`map`, N-10 br. 18; not part of this task). "Prikaži mjesto u radu" is offered only for an anchor the map
 * reports in `anchors`. There is no role prop: the summary is the one the student sees (PRODUCT §5 rule 5).
 */
export default function SummaryPage({ port, documentId, workHref, signInHref, map, anchors = new Set() }: {
  port: N10Port; documentId: string; workHref: string; signInHref: string; map?: ReactNode; anchors?: ReadonlySet<string>;
}) {
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

  const heading = <h1 id="sm-h">{text.title}</h1>;
  let body: ReactNode;
  if (read === null || read.kind === "signedOut") body = <section aria-labelledby="sm-h" aria-busy="true">{heading}<Skeleton label={text.loading} /></section>;
  else if (read.kind === "unavailable") {
    body = (
      <section aria-labelledby="sm-h">{heading}
        <p role="alert">{text.error}</p>
        <Button tone="quiet" onClick={() => setAttempt((n) => n + 1)}>{text.retry}</Button>
      </section>
    );
  } else if (read.kind === "notFound") body = <section aria-labelledby="sm-h">{heading}<p role="alert">{text.notFound}</p></section>;
  else if (read.kind === "empty") body = <section aria-labelledby="sm-h">{heading}<p className="note">{text.empty}</p></section>;
  else {
    body = (
      <div className={styles.layout}>
        <section className={styles.main} aria-labelledby="sm-h">{heading}<Sections read={read} anchors={anchors} /></section>
        {map !== undefined && <aside className={styles.aside}>{map}</aside>}
      </div>
    );
  }
  return (
    <div className="page">
      <p><a href={workHref}>{text.backToWork}</a></p>
      {body}
    </div>
  );
}
