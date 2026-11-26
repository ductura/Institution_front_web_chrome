"use client";

import { useId, useState } from "react";
import { Button, DataTable, Skeleton, type DataTableColumn } from "@ductura/ui";

import { workPageStyles as styles } from "../n07/WorkPage";

import { excerpt, nextMark, type Mark, type MarkedBlock, type Run } from "./marked-text";
import { provenanceText as p } from "./messages.hr";
import type { OriginKind } from "./origin";
import { markedTextMessages as t } from "./text-messages.hr";
import type { TextState } from "./text-read";

/** The line under a marked range, as in the legend: dashed for a paste, double for the Asistent, dotted for an import. */
const LINE: Record<Exclude<OriginKind, "typed">, string | undefined> = {
  pasted_known: styles.pvPaste,
  pasted_unknown: styles.pvPaste,
  assistant_inserted: styles.pvAi,
  assistant_match: styles.pvAi,
  imported_file: styles.pvImp,
};

/**
 * PG-2 "Tekst rada s oznakama podrijetla" (WEB-NF5-KARTA; prototype pgMarkText): the text of the revision the
 * ranges belong to, each marked range with its kind in words next to the line. "Sljedeće lijepljenje ili prijenos"
 * moves the focus to the next mark and says which one it is only then (a status, not a running announcement). The
 * table lists the same marks without line or colour. `origin` off hides the lines and words, as the legend says.
 */
export default function MarkedText({ state, origin, typed, onRetry }: {
  state: TextState; origin: boolean; typed: boolean; onRetry: () => void;
}) {
  const prefix = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const [current, setCurrent] = useState(0);
  const [status, setStatus] = useState("");
  if (state.kind === "loading") return <Skeleton label={t.loading} />;
  const sheet = `sheet ${styles.paper} ${origin ? "" : styles.off} ${typed ? styles.typedOn : ""}`;
  const switches = { "data-map-text": "", "data-origin": origin ? "on" : "off", "data-typed": typed ? "on" : "off" };
  if (state.kind === "noRanges") return <div {...switches} className={sheet}><p className="note" role="status">{p.textUnavailable}</p></div>;
  if (state.kind === "notFound") return <p className="note" role="alert">{p.notFound}</p>;
  if (state.kind === "signedOut") return <p className="note" role="alert">{p.signedOut}</p>;
  if (state.kind === "unavailable") {
    return <>
      <p className="note" role="alert">{t.unavailable}</p>
      <div className={styles.acts}><Button tone="secondary" onClick={onRetry}>{t.retry}</Button></div>
    </>;
  }
  const { text } = state;
  const step = () => {
    const mark = nextMark(current, text.marks.length);
    const target = text.marks[mark - 1];
    if (target === undefined) return;
    setCurrent(mark);
    setStatus(t.markStatus(mark, text.marks.length, target.kind));
    const node = document.getElementById(`${prefix}-m${mark}`);
    node?.scrollIntoView?.({ block: "center" });
    node?.focus();
  };
  const columns: DataTableColumn<Mark>[] = [
    { id: "text", header: t.colText, rowHeader: true, cell: (mark) => excerpt(mark.text) },
    { id: "kind", header: t.colKind, cell: (mark) => t.markLabel(mark.kind, mark.mark) },
    { id: "place", header: t.colPlace, cell: (mark) => t.place(mark.block) },
  ];
  return (
    <div data-marked-text={text.revision}>
      <h3>{t.heading}</h3>
      <p className="meta">{t.revision(text.revision)}</p>
      <div className={styles.acts}>
        <Button tone="secondary" onClick={step} disabled={!origin || text.marks.length === 0} data-next-mark>{t.next}</Button>
      </div>
      <p className="note" role="status" data-mark-status>{status}</p>
      <p className="meta">{t.wordsNote} <b>{t.whoTyped}</b> {t.notProof}</p>
      {text.marks.length === 0 && <p className="note">{t.noMarksInText}</p>}
      <div {...switches} className={sheet}>
        {text.blocks.map((block) => <Block key={block.id} block={block} prefix={prefix} typed={typed} />)}
      </div>
      {text.skipped > 0 && <p className="note">{t.skipped(text.skipped)}</p>}
      <DataTable caption={t.tableCaption} columns={columns} rows={text.marks} rowKey={(mark) => String(mark.mark)} empty={t.tableEmpty} />
    </div>
  );
}

/**
 * A block wholly in typed ranges carries the typed line and words once; in a block of several kinds the typed words
 * stand after each typed range only, so the display never claims more than the record (a paste stays a paste).
 */
function Block({ block, prefix, typed }: { block: MarkedBlock; prefix: string; typed: boolean }) {
  const runs = block.runs.map((run, index) => <Piece key={index} run={run} prefix={prefix} typed={typed && !block.typed} />);
  const typedLabel = typed && block.typed ? <span className={styles.pvLabel} data-typed-label>{t.kind("typed")}</span> : null;
  return block.heading
    ? <h2 data-block={block.id}>{runs}{typedLabel}</h2>
    : <p data-block={block.id} className={block.typed ? styles.pvTyped : undefined}>{runs}{typedLabel}</p>;
}

function Piece({ run, prefix, typed }: { run: Run; prefix: string; typed: boolean }) {
  if (run.kind === "typed") {
    return typed ? <><span data-kind="typed">{run.text}</span><span className={styles.pvLabel} data-typed-label>{t.kind("typed")}</span></> : <>{run.text}</>;
  }
  if (run.kind === null || run.mark === null) return <>{run.text}</>;
  return <>
    <span id={`${prefix}-m${run.mark}`} tabIndex={-1} data-kind={run.kind} className={LINE[run.kind]}>{run.text}</span>
    <span className={styles.pvLabel} data-mark-label>{t.markLabel(run.kind, run.mark)}</span>
  </>;
}
