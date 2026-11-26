"use client";

import { Button } from "@ductura/ui";
import { useEffect, useMemo, useState, type KeyboardEvent, type ReactNode } from "react";

import type { ReplayPlayer } from "@/client/replay-record/replay-player";
import type { SessionMark } from "@/client/session-marks";
import { blockRuns } from "@/components/shell/manuscript-blocks";
import SheetFrame from "@/components/shell/SheetFrame";
import { useReplay } from "@/components/replay/ReplayView";
import replayStyles from "@/components/replay/ReplayView.module.css";
import {
  atomLabel, deletedOption, deletedParagraphs, describeChange, fill, gapWords, historyRows, nodeText, paragraphOption, replayBlocks,
  replaySources, stepsOf, type ChangePart,
} from "@/components/replay/replay-view";
import type { DocumentNode, DocumentNodeV3 } from "@/domain/document";
import { messagesHr } from "@/lib/i18n/messages.hr";

import { n09Messages as m } from "./messages.hr";
import { followingStep, keyAction, parseSpeed, playable, precedingStep, sourceTag, stepDelay, SPEEDS, type Speed } from "./model";
import styles from "./Replay.module.css";
import { WorkPage, WorkPanel, workPageStyles as page } from "../n07/WorkPage";

const t = messagesHr.replay;
type Player = Extract<ReplayPlayer, { ok: true }>;

function Block({ node, touched, sources }: { node: DocumentNodeV3; touched: boolean; sources: readonly unknown[] }) {
  const kids = node.children.map((c, i) => {
    // A citation, a footnote or a cross reference (v3) is shown, never left out (INT-23).
    if (c.type !== "text") return <span key={i} data-atom={c.type}>{atomLabel(c, sources)}</span>;
    let content: ReactNode = c.text;
    if (c.marks.includes("italic")) content = <em>{content}</em>;
    if (c.marks.includes("bold")) content = <strong>{content}</strong>;
    return <span key={i}>{content}</span>;
  });
  const props = { "data-node-id": node.id, className: touched ? replayStyles.touched : undefined };
  if (node.type === "paragraph" || node.type === "quote") return <p {...props}>{kids}</p>;
  if (node.type === "bulletItem") return <li {...props}>{kids}</li>;
  const Tag = node.level === 1 ? "h2" : node.level === 2 ? "h3" : "h4";
  return <Tag {...props}>{kids}</Tag>;
}

function Text({ nodes, touched, sources }: { nodes: readonly DocumentNodeV3[]; touched: ReadonlySet<string>; sources: readonly unknown[] }) {
  const block = (node: DocumentNodeV3) => <Block key={node.id} node={node} touched={touched.has(node.id)} sources={sources} />;
  return (
    <SheetFrame>
      <div className={`manuscript ${replayStyles.text}`} role="document" aria-label={t.sheetLabel}>
        {/* blockRuns reads only the block types, which v3 shares with v1. */}
        {blockRuns([...nodes] as DocumentNode[]).map((run) => run.kind === "list" ? <ul key={run.items[0]!.id}>{run.items.map(block)}</ul>
          : run.kind === "quote" ? <blockquote key={run.items[0]!.id}>{run.items.map(block)}</blockquote> : block(run.node))}
      </div>
    </SheetFrame>
  );
}

const ordinalIn = (nodes: readonly DocumentNodeV3[] | null, id: string): number | null => {
  const i = nodes?.findIndex((node) => node.id === id) ?? -1;
  return i < 0 ? null : i + 1;
};

/** The player over one verified record; `n` is the change shown (from 1; 0 only for a record with gaps and no change). */
export function N09Player({ player }: { player: Player }) {
  const [n, setN] = useState(player.total);
  const [scoped, setScoped] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<Speed>(1);

  const finalNodes = useMemo(() => replayBlocks(player.documentAt(player.total)) ?? [], [player]);
  const nodes = useMemo(() => replayBlocks(player.documentAt(n)), [player, n]);
  const priorNodes = useMemo(() => (n > 0 ? replayBlocks(player.documentAt(n - 1)) : null), [player, n]);
  const change = useMemo(() => player.entries.flatMap((e) => (e.entry === "change" && e.change.index === n ? [e.change] : []))[0] ?? null, [player, n]);
  const gaps = useMemo(() => player.entries.flatMap((e) => (e.entry === "gap" ? [e] : [])), [player]);
  const deleted = useMemo(() => deletedParagraphs(
    player.entries.flatMap((e) => (e.entry === "change" ? [e.change] : [])), new Set(finalNodes.map((node) => node.id)),
  ), [player, finalNodes]);
  const steps = useMemo(() => playable(stepsOf(player.total, scoped === null ? null : player.paragraphHistory(scoped))), [player, scoped]);
  const place = Math.max(0, steps.reduce((p, s, i) => (s <= n ? i : p), 0));

  const next = followingStep(steps, n);
  useEffect(() => {
    if (!playing) return;
    if (next === null) { setPlaying(false); return; }
    const timer = setTimeout(() => setN(next), stepDelay(speed));
    return () => clearTimeout(timer);
  }, [playing, next, speed]);

  const shownId = scoped ?? change?.blockIds[0] ?? null;
  const shownHistory = useMemo(() => (shownId === null ? null : player.paragraphHistory(shownId)), [player, shownId]);
  const touchedHistories = useMemo(() => (change?.blockIds ?? []).map((id) => ({ id, history: player.paragraphHistory(id) })), [player, change]);

  if (nodes === null) return <p className={replayStyles.state} role="alert">{t.unavailable}</p>;

  const ordinal = (id: string) => ordinalIn(nodes, id) ?? ordinalIn(priorNodes, id);
  const parts: ChangePart[] = touchedHistories.flatMap(({ id, history }) => {
    const entry = history.find((e) => e.entry === "change" && e.index === n);
    return entry?.entry === "change" ? [{ ordinal: ordinal(id), removed: entry.removed, inserted: entry.inserted }] : [];
  });
  const shownNode = nodes.find((node) => node.id === shownId);
  const rows = shownHistory === null ? [] : historyRows(shownHistory, n, shownNode === undefined ? null : nodeText(shownNode));
  const shownOrdinal = shownId === null ? null : ordinal(shownId);
  const here = gaps.filter((g) => g.beforeIndex === n || (g.beforeIndex === n + 1 && (g.gap === "not_resumed" || n === 0)));
  const tag = change === null ? null : sourceTag(change.source);

  const listed = (id: string | undefined) => (id !== undefined && (finalNodes.some((node) => node.id === id) || deleted.includes(id)) ? id : undefined);
  const choose = (id: string | null) => {
    setScoped(id);
    if (id === null) return;
    const own = playable(stepsOf(player.total, player.paragraphHistory(id)));
    if (own.length > 0) setN(own.reduce((p, s) => (s <= n ? s : p), own[0]!));
  };
  const seek = (to: number | null) => { setPlaying(false); if (to !== null) setN(to); };
  const toggle = () => {
    if (playing) { setPlaying(false); return; }
    if (next === null && steps[0] !== undefined) setN(steps[0]);
    setPlaying(true);
  };
  const scopeButton = (label: string, on: boolean, act: () => void) =>
    <button type="button" className={on ? "btn" : "btn secondary"} aria-pressed={on} onClick={act}>{label}</button>;
  const prev = precedingStep(steps, n);
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const act = keyAction(e.key, e.target as Element, { ctrl: e.ctrlKey, alt: e.altKey, meta: e.metaKey, shift: e.shiftKey });
    if (act === null) return;
    e.preventDefault();
    if (act === "toggle") toggle();
    else if (act === "previous") seek(prev);
    else if (act === "next") seek(next);
    else if (act === "first") seek(steps[0] ?? null);
    else seek(steps[steps.length - 1] ?? null);
  };
  const spoken = change === null ? t.startLive : describeChange(n, change.kind, parts);

  return (
    <div className={replayStyles.player} onKeyDown={onKeyDown}>
      <div className={styles.ctl} role="group" aria-label={m.controlsLabel}>
        <button type="button" className="btn" aria-pressed={playing} disabled={steps.length === 0} onClick={toggle}>{playing ? m.stop : m.play}</button>
        <button type="button" className={"btn secondary"} disabled={prev === null} onClick={() => seek(prev)}>{m.previous}</button>
        <button type="button" className={"btn secondary"} disabled={next === null} onClick={() => seek(next)}>{m.next}</button>
        <label className={page.inline}><span className="lbl">{m.speed}</span>
          <select className="input" value={speed} onChange={(e) => setSpeed(parseSpeed(e.currentTarget.value))}>
            {SPEEDS.map((s) => <option key={s} value={s}>{`${s}×`}</option>)}
          </select>
        </label>
        <label className={page.inline}><span className="lbl">{m.jump}</span>
          <select className="input" disabled aria-describedby="rp-jump-note" value="">
            <option value="">{m.jumpUnavailable}</option>
          </select>
        </label>
      </div>
      <p id="rp-jump-note" className={replayStyles.meta}>{m.jumpNote}</p>
      <p className={replayStyles.meta}>{m.keys}</p>
      {steps.length > 0 && (
        <div className={styles.range}>
          <label htmlFor="rp-r" className={replayStyles.meta}>{m.slider}</label>
          <input type="range" id="rp-r" min={0} max={steps.length - 1} value={place} aria-valuetext={m.sliderValue(steps[place]!, player.total)}
            onChange={(e) => seek(steps[e.currentTarget.valueAsNumber] ?? null)} />
        </div>
      )}
      <p aria-live="polite" role="status">
        <b>{m.sliderValue(n, player.total)}</b>
        {tag !== null && <> · {m.sourceLead} <span className={replayStyles.srcTag}>{tag.text}</span></>}
        {here.length > 0 && <> · <span className={replayStyles.srcTag}>{m.sourceGap}</span></>}
        <span className="visually-hidden"> {spoken}</span>
      </p>
      {here.map((g) => {
        const words = gapWords(g.gap, g.beforeIndex);
        return <div key={`${g.gap}-${g.beforeIndex}`} className={replayStyles.gap} role="note"><strong>{t.gapTitle}</strong><span>{words.text}</span>{words.note !== null && <span>{words.note}</span>}</div>;
      })}
      <Text nodes={nodes} touched={new Set(change?.blockIds ?? [])} sources={replaySources(player.documentAt(n))} />
      {shownId !== null && (
        <section className={replayStyles.card} aria-labelledby="replay-history">
          <h2 id="replay-history" className={replayStyles.cardTitle}>{shownOrdinal === null ? t.historyTitleDeleted : fill(t.historyTitle, { k: shownOrdinal })}</h2>
          {rows.length === 0 ? <p className={replayStyles.meta}>{t.historyNone}</p> : (
            <div className={replayStyles.tableWrap}>
              <table className={replayStyles.table}>
                <thead><tr><th scope="col">{t.historyVersion}</th><th scope="col">{t.historyReplaced}</th><th scope="col">{t.historyOrigin}</th></tr></thead>
                <tbody>{rows.map((row, i) => row.row === "gap"
                  ? <tr key={i}><td colSpan={3} className={replayStyles.gapRow}>{row.text}</td></tr>
                  : <tr key={i}><td>{`${row.label}: ${row.text}`}</td><td>{row.replacedBy}</td><td><span className={replayStyles.srcTag}>{row.source}</span></td></tr>)}</tbody>
              </table>
            </div>
          )}
          <p className={replayStyles.meta}>{t.historyNote}</p>
        </section>
      )}
      <section className={replayStyles.card} aria-labelledby="replay-scope">
        <h2 id="replay-scope" className={replayStyles.cardTitle}>{t.scopeTitle}</h2>
        <div className={replayStyles.row}>
          {scopeButton(t.scopeWhole, scoped === null, () => choose(null))}
          {scopeButton(t.scopeOne, scoped !== null, () => choose(listed(change?.blockIds[0]) ?? finalNodes[0]?.id ?? null))}
          <label className={replayStyles.meta} htmlFor="replay-paragraph">{t.paragraph}</label>
          <select id="replay-paragraph" className={replayStyles.select} value={scoped ?? ""} disabled={scoped === null} onChange={(e) => choose(e.currentTarget.value)}>
            {finalNodes.map((node, i) => <option key={node.id} value={node.id}>{paragraphOption(i + 1, node)}</option>)}
            {deleted.map((id) => <option key={id} value={id}>{deletedOption(player.paragraphHistory(id))}</option>)}
          </select>
        </div>
        <p className={replayStyles.meta}>{t.scopeNote}</p>
        {steps.length === 0 && <p className={replayStyles.meta}>{t.scopeNone}</p>}
      </section>
      {gaps.length > 0 && (
        <section className={replayStyles.card} aria-labelledby="replay-gaps">
          <h2 id="replay-gaps" className={replayStyles.cardTitle}>{gaps.length === 1 ? t.gapTitle : t.gapsTitle}</h2>
          <ul className={replayStyles.gapList}>{gaps.map((g) => {
            const words = gapWords(g.gap, g.beforeIndex);
            return (
              <li key={`${g.gap}-${g.beforeIndex}`}><span>{words.text}</span>
                {words.target !== null && words.target >= 1 && (
                  <button type="button" className={"btn secondary"} onClick={() => { setScoped(null); seek(words.target); }}>{fill(t.goTo, { n: words.target })}</button>
                )}
              </li>
            );
          })}</ul>
        </section>
      )}
    </div>
  );
}

/** N-09 page (prototype `reprodukcija`): the work page frame, the panel `rp-h`, the state of the reading, the player and the foot line. */
export default function ReplayPage({ documentId, session, workHref }: { documentId: string; session: SessionMark | null; workHref: string }) {
  const { outcome, retry } = useReplay(documentId, session);
  let panel: ReactNode;
  if (outcome.kind === "loading") {
    panel = (
      <WorkPanel id="pg-h" title={m.title} busy>
        <p className="note" role="status">{m.loading}</p><div className="skel w80" /><div className="skel w60" /><div className="skel w40" />
      </WorkPanel>
    );
  } else if (outcome.kind === "ok") {
    const { player } = outcome;
    panel = player.total === 0 && !player.entries.some((e) => e.entry === "gap")
      ? <WorkPanel id="pg-h" title={m.title}><p className="note">{m.empty}</p></WorkPanel>
      : (
        <WorkPanel id="rp-h" title={m.title}>
          <p className="note">{m.intro}</p>
          <N09Player key={documentId} player={player} />
          <p className="meta">{m.foot}</p>
        </WorkPanel>
      );
  } else if (outcome.kind === "unavailable") {
    panel = (
      <WorkPanel id="pg-h" title={m.title}>
        <p className="note" role="alert">{m.error}</p>
        <div className={page.acts}><Button tone="secondary" onClick={retry}>{m.retry}</Button></div>
      </WorkPanel>
    );
  } else panel = <WorkPanel id="pg-h" title={m.title}><p className="note" role="alert">{outcome.kind === "notFound" ? t.notFound : t.signedOut}</p></WorkPanel>;
  return <WorkPage back={workHref} backLabel={m.backToWork}>{panel}</WorkPage>;
}
