"use client";

// WEB-V13-NASTAVNIK-PREGLED: the teacher reads the slides of a work (reading only): the list of slides, one slide
// with its speaker notes, the choice of a revision, the process by stepping through revisions and the comparison of
// two revisions. `SlidesOrWork` is the one branch the teacher's work page makes by kind: a slides work opens
// here, any other work keeps the existing page (`fallback`). Every state is the server's answer: loading and error
// are never shown as "no slides". Somebody else's work is 404 on the server and "not available" here.
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Button, Select } from "@ductura/ui";

import { goToSignIn } from "../../../../../../src/client/api.ts";
import { appHref } from "../../../../../../src/components/shell/nav.ts";
import { LAYOUT_SLOTS, type Slide, type SlideBlock, type SlidesDocument } from "../../../../../editor-core/src/slides/index.ts";
import { useHost } from "../../context";
import SlidesExport from "../../slides/export/SlidesExport.tsx";
import { SlideDiff } from "./SlideDiff.tsx";
import { fill, layoutNames, slidesReviewText as t, slotNames } from "./messages.hr.ts";
import { slideTitle } from "./model.ts";
import { readSlidesRevision, readSlidesRevisions, type Revision, type RevisionRead, type SlidesRevisions } from "./read.ts";

function Block({ block }: { block: SlideBlock }) {
  if (block.type === "image") return <p>{fill(t.imageBlock, { alt: block.alt })}</p>;
  if (block.type === "list") return <ul>{block.items.map((item, index) => <li key={index}>{item}</li>)}</ul>;
  return block.type === "heading" ? <h3>{block.text}</h3> : <p>{block.text}</p>;
}

function SlideView({ slide, index, total }: { slide: Slide; index: number; total: number }) {
  return (
    <section aria-label={fill(t.slideOf, { n: index + 1, total })}>
      <h2>{fill(t.slideOf, { n: index + 1, total })}</h2>
      <p>{t.layout}: {layoutNames[slide.layout]}</p>
      {slide.blocks.length === 0 ? <p>{t.emptySlide}</p> : LAYOUT_SLOTS[slide.layout].map((slot) => {
        const blocks = slide.blocks.filter((block) => block.slot === slot);
        return blocks.length === 0 ? null : (
          <div key={slot}><h3>{slotNames[slot]}</h3>{blocks.map((block) => <Block key={block.id} block={block} />)}</div>
        );
      })}
      <h3>{t.notesTitle}</h3>
      <p>{slide.notes ?? t.noNotes}</p>
    </section>
  );
}

const revisionLabel = (r: Revision) => fill(t.revisionOption, {
  n: r.revision, kind: r.kind === "submission" ? t.kindSubmission : t.kindCheckpoint, minute: r.savedMinute.slice(0, 16).replace("T", " "),
});

type Loaded = { readonly revision: number; readonly state: RevisionRead };

/** Reads one revision when it is chosen; the last answer for a revision stays, a failed one is read again on retry. */
function useRevision(documentId: string, revision: number | null, attempt: number): RevisionRead | "loading" {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  useEffect(() => {
    if (revision === null) return;
    let live = true;
    void readSlidesRevision(documentId, revision).then((state) => { if (live) setLoaded({ revision, state }); });
    return () => { live = false; };
  }, [documentId, revision, attempt]);
  return revision !== null && loaded?.revision === revision ? loaded.state : "loading";
}

function Failure({ state, onRetry }: { state: { kind: "signedOut" | "notFound" | "unavailable" | "invalid" }; onRetry: () => void }) {
  const text = state.kind === "signedOut" ? t.signedOut : state.kind === "notFound" ? t.notFound : state.kind === "invalid" ? t.invalid : t.unavailable;
  return <><p role="alert">{text}</p>{state.kind === "notFound" ? null : <Button onClick={onRetry}>{t.retry}</Button>}</>;
}

export function SlidesReview({ documentId, path, revisions, more }: {
  documentId: string; path: string; revisions: readonly Revision[]; more: boolean;
}) {
  const { base } = useHost();
  const newest = revisions[0]!.revision;
  const [shown, setShown] = useState(newest);
  const [slideIndex, setSlideIndex] = useState(0);
  const [compareWith, setCompareWith] = useState<number | null>(null);
  const [attempt, setAttempt] = useState(0);
  const main = useRevision(documentId, shown, attempt);
  const other = useRevision(documentId, compareWith, attempt);
  const ordered = useMemo(() => [...revisions].sort((a, b) => a.revision - b.revision), [revisions]);
  const at = ordered.findIndex((r) => r.revision === shown);
  const options = revisions.map((r) => ({ value: String(r.revision), label: revisionLabel(r) }));
  const retry = () => setAttempt((n) => n + 1);

  const pick = (revision: number) => { setShown(revision); setSlideIndex(0); };
  const doc: SlidesDocument | null = main !== "loading" && main.kind === "ready" ? main.document : null;
  const clamped = doc === null ? 0 : Math.min(slideIndex, Math.max(doc.slides.length - 1, 0));
  const failed = main !== "loading" && main.kind !== "ready" ? main : null;
  if (failed?.kind === "signedOut") goToSignIn(appHref(base, path));

  return (
    <div className="page">
      <h1>{t.title}</h1>
      <p role="note">{t.readOnly}</p>
      <section aria-label={t.revisionLabel}>
        <Select label={t.revisionSelect} options={options} value={String(shown)} onChange={(event) => pick(Number(event.target.value))} />
        <Button onClick={() => pick(ordered[at - 1]!.revision)} disabled={at <= 0}>{t.previous}</Button>
        <Button onClick={() => pick(ordered[at + 1]!.revision)} disabled={at < 0 || at >= ordered.length - 1}>{t.next}</Button>
        <p>{t.replayHint}</p>
        {more ? <p role="note">{t.olderExist}</p> : null}
      </section>
      {main === "loading" ? <p role="status">{t.loading}</p> : null}
      {failed !== null ? <Failure state={failed} onRetry={retry} /> : null}
      {doc !== null ? (
        doc.slides.length === 0 ? <p role="status">{t.noSlides}</p> : (
          <>
            <nav aria-label={t.slideListLabel}>
              <ol>
                {doc.slides.map((slide, index) => (
                  <li key={slide.id}>
                    <Button onClick={() => setSlideIndex(index)} aria-current={index === clamped ? "true" : undefined}>
                      {fill(t.selectSlide, { n: index + 1, title: slideTitle(slide) ?? t.untitled })}
                    </Button>
                  </li>
                ))}
              </ol>
            </nav>
            <SlideView slide={doc.slides[clamped]!} index={clamped} total={doc.slides.length} />
          </>
        )
      ) : null}
      <section aria-label={t.compareTitle}>
        {revisions.length < 2 ? <p role="note">{t.compareNeedTwo}</p> : (
          <>
            <Select label={t.compareFrom} options={[{ value: "", label: "—" }, ...options]} value={compareWith === null ? "" : String(compareWith)}
              onChange={(event) => setCompareWith(event.target.value === "" ? null : Number(event.target.value))} />
            {compareWith === shown ? <p role="note">{t.compareSame}</p> : null}
            {compareWith !== null && compareWith !== shown ? (
              other === "loading" || main === "loading" ? <p role="status">{t.compareLoading}</p>
                : other.kind !== "ready" ? <Failure state={other} onRetry={retry} />
                : doc === null ? null
                : compareWith < shown ? <SlideDiff older={other.document} newer={doc} /> : <SlideDiff older={doc} newer={other.document} />
            ) : null}
          </>
        )}
      </section>
      <SlidesExport documentId={documentId} title={null} confirmed versionId={String(shown)} here={path} />
    </div>
  );
}

/** The branch by kind: slides open here, everything else is `fallback` (the existing page of the work). */
export function SlidesOrWork({ documentId, path, fallback, read = readSlidesRevisions }: {
  documentId: string; path: string; fallback: ReactNode; read?: (documentId: string) => Promise<SlidesRevisions>;
}) {
  const [answer, setAnswer] = useState<SlidesRevisions | null>(null);
  useEffect(() => {
    let live = true;
    setAnswer(null);
    void read(documentId).then((value) => { if (live) setAnswer(value); });
    return () => { live = false; };
  }, [documentId, read]);
  if (answer === null) return <div className="page"><p role="status">{t.loading}</p></div>;
  if (answer.kind === "slides") return <SlidesReview key={documentId} documentId={documentId} path={path} revisions={answer.revisions} more={answer.more} />;
  // Text works, and every failed read of the kind, keep the existing page, which shows its own 401/404/unavailable.
  return <>{fallback}</>;
}
