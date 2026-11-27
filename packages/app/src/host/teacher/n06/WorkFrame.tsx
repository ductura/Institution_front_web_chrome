"use client";

import { Skeleton } from "@ductura/ui";
import { useEffect, useState, type ReactNode } from "react";

import type { LiveDocument } from "@/client/live-publisher";
import { WorkPage } from "../n07/WorkPage";
import Fingerprint from "./Fingerprint";
import { RevisionSection } from "../revision";
import styles from "./frame.module.css";
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
export default function WorkFrame({ documentId, current = () => true, gaps, deadlinePassed = null, started = true, shownSubmitted = null, text: body, aside }: {
  documentId: string; current?: () => boolean; gaps: readonly ProcessGap[]; deadlinePassed?: boolean | null; started?: boolean;
  /** Dokument na zaslonu kad je to predana verzija (live route ga je označio kao `submitted`); inače null. */
  shownSubmitted?: LiveDocument | null;
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
  const backHref = appHref(base, "/nastavnik/kolegiji");
  const layout = (inner: ReactNode) => <div className={styles.two}>{inner}</div>;
  const sheet = (
    <><div role="region" aria-label={text.sheetLabel}>{body}</div></>
  );
  if (read === null) return <WorkPage back={backHref} backLabel={text.backToCourses}><Skeleton label={text.loading} /></WorkPage>;
  if (read.kind !== "ready") {
    return (
      <WorkPage back={backHref} backLabel={text.backToCourses}>
        <p role="alert">{text.error}</p>
        <button type="button" className="btn" onClick={() => setAttempt((n) => n + 1)}>{text.retry}</button>
        {layout(<><div className={styles.main}>{sheet}</div><aside className={styles.aside}>{aside}</aside></>)}
      </WorkPage>
    );
  }
  const facts: Facts = read.facts;
  const items = sequence(facts);
  const gapText = isSubmitted(facts) ? gapsBanner(gaps) : null;
  // Otisak samo za predanu verziju s potpisanom potvrdom: jedino za nju poslužitelj daje zabilježeni SHA-256.
  const fingerprint = shownSubmitted !== null && facts.receipt !== null && isSubmitted(facts)
    ? <Fingerprint document={shownSubmitted} recorded={{ sha256: facts.receipt.sha256, revision: facts.receipt.version }} />
    : undefined;
  const step = (id: string | null, label: string, rel: "prev" | "next") => {
    const href = liveWorkHref(id);
    return href === null ? <span aria-disabled="true" className="btn secondary">{label}</span>
      : <a href={appHref(base, href)} rel={rel} className="btn secondary">{label}</a>;
  };
  return (
    <RevisionSection documentId={documentId} current={current} compareHref={isSubmitted(facts) && workPath !== "" ? appHref(base, `${workPath}/usporedba`) : undefined}>
      {(rev) => (
        <WorkPage back={backHref} backLabel={text.backToCourses} crumb={heading(facts)} wide status={fingerprint}>
          <section className={`panel ${styles.head}`}>
            <h1>{heading(facts)}</h1>
            <p>{stateLine(facts)}</p>
            {items.length === 0 ? <p className="meta">{text.seqEmpty}</p>
              : <ol className="facts" aria-label={text.seqLabel}>{items.map((i) => <li key={i}>{i}</li>)}</ol>}
            <nav className={styles.links} aria-label={text.linksLabel}>
              {links(facts, workPath).map((l) => <a key={l.key} href={l.path.startsWith("#") ? l.path : appHref(base, l.path)}>{l.label}</a>)}
            </nav>
            <div className={styles.acts}>
              {rev.action}
              <nav className={styles.acts} aria-label={text.steps}>{step(facts.previousId, text.prev, "prev")}{step(facts.nextId, text.next, "next")}</nav>
            </div>
          </section>
          {rev.banner}
          {gapText !== null && <div className="banner" role="status"><p>{gapText}</p><a href={appHref(base, `${workPath}/sazetak`)}>{text.gapsLink}</a></div>}
          {showNotSubmittedBanner(facts, deadlinePassed) && (
            <div className="banner" role="status"><p>{text.notSubmittedBanner}</p><a href={appHref(base, extensionPath(facts.assignmentId))}>{text.extensionLink}</a></div>
          )}
          {!started ? <p className="note">{text.notStarted}</p> : layout(<>
            <div className={styles.main}>{sheet}</div>
            <aside className={styles.aside} id="sazetak-procesa">{aside}</aside>
          </>)}
          {rev.dialog}
        </WorkPage>
      )}
    </RevisionSection>
  );
}
