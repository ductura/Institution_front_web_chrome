"use client";

import { Skeleton } from "@ductura/ui";
import { useEffect, useState, type ReactNode } from "react";

import styles from "@/components/teacher/LiveWorkView.module.css";
import { appHref } from "@/components/shell/nav";
import { liveWorkHref } from "@/components/teacher/LiveWorkFrame";
import { useHost } from "../../context";
import { extensionPath, gapsBanner, heading, isSubmitted, links, sequence, showNotSubmittedBanner, stateLine, type Facts, type ProcessGap } from "./model";
import { readFrame, type FrameRead } from "./read";
import { workFrameMessages as text } from "./messages.hr";

/**
 * N-06 frame around the work (WEB-2150): back link, heading, state line, "Slijed rada", links, previous/next work
 * and the banners. The text and the aside stay the page's (LiveText, comments, summary); nothing here writes.
 */
export default function WorkFrame({ documentId, gaps, deadlinePassed = null, started = true, text: body, aside }: {
  documentId: string; gaps: readonly ProcessGap[]; deadlinePassed?: boolean | null; started?: boolean;
  text: ReactNode; aside: ReactNode;
}) {
  const { base } = useHost();
  const [read, setRead] = useState<FrameRead | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let live = true;
    setRead(null);
    void readFrame(documentId).then((next) => { if (live) setRead(next); });
    return () => { live = false; };
  }, [documentId, attempt]);

  const workPath = liveWorkHref(documentId) ?? "";
  const back = <p><a href={appHref(base, "/nastavnik/kolegiji")}>{text.backToCourses}</a></p>;
  if (read === null) return <div>{back}<Skeleton label={text.loading} /></div>;
  if (read.kind !== "ready") {
    return (
      <div>{back}
        <p role="alert">{text.error}</p>
        <button type="button" className="btn" onClick={() => setAttempt((n) => n + 1)}>{text.retry}</button>
        <div className={styles.layout}><div className={styles.main}>{body}</div><aside className={styles.aside}>{aside}</aside></div>
      </div>
    );
  }
  const facts: Facts = read.facts;
  const items = sequence(facts);
  const gapText = isSubmitted(facts) ? gapsBanner(gaps) : null;
  const step = (id: string | null, label: string, rel: "prev" | "next") => {
    const href = liveWorkHref(id);
    return href === null ? <span aria-disabled="true" className="btn secondary">{label}</span>
      : <a href={appHref(base, href)} rel={rel} className="btn secondary">{label}</a>;
  };
  return (
    <div>
      {back}
      <section className="panel rd-head">
        <h1>{heading(facts)}</h1>
        <p>{stateLine(facts)}</p>
        {items.length === 0 ? <p className="meta">{text.seqEmpty}</p>
          : <ol className="facts" aria-label={text.seqLabel}>{items.map((i) => <li key={i}>{i}</li>)}</ol>}
        <nav className="rd-links" aria-label={text.linksLabel}>
          {links(facts, workPath).map((l) => <a key={l.key} href={l.path.startsWith("#") ? l.path : appHref(base, l.path)}>{l.label}</a>)}
        </nav>
        <nav className="acts" aria-label={text.steps}>{step(facts.previousId, text.prev, "prev")}{step(facts.nextId, text.next, "next")}</nav>
      </section>
      {gapText !== null && <div className="banner" role="status"><p>{gapText}</p><a href={appHref(base, `${workPath}/sazetak`)}>{text.gapsLink}</a></div>}
      {showNotSubmittedBanner(facts, deadlinePassed) && (
        <div className="banner" role="status"><p>{text.notSubmittedBanner}</p><a href={appHref(base, extensionPath(facts.assignmentId))}>{text.extensionLink}</a></div>
      )}
      {!started ? <p className="note">{text.notStarted}</p> : (
        <div className={styles.layout}><div className={styles.main}>{body}</div><aside className={styles.aside} id="sazetak-procesa">{aside}</aside></div>
      )}
    </div>
  );
}
