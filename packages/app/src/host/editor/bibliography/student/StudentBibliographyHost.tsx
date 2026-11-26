"use client";

import { Button, Details, Dialog, TextArea } from "@ductura/ui";
import { TextSelection } from "@tiptap/pm/state";
import { useEffect, useMemo, useRef, useState } from "react";
import type { useLocalEditor } from "@/components/editor/LocalDocument";
import { scanBarcode, type ScanResult } from "./barcode";
import {
  bibSources, citePlaces, missingFields, overviewRows, possibleDuplicates, relianceNotes, sourceStats,
  type BibSource, type CitePlace,
} from "./bibliography-model";
import styles from "./StudentBibliography.module.css";
import { planImport } from "./import-refs";
import { defaultEffectiveStyle, effectiveStyle, styledLiterature, type EffectiveStyle } from "./styled-entries";
import { useInstitutionStyle } from "../../citation-styles/use-institution-style";
import { bibliographyStudentHr as t } from "./messages.hr";
import { readStates, stateCounts, toggleState, writeStates, type SourceState, type SourceStates } from "./source-state";

type Editor = NonNullable<ReturnType<typeof useLocalEditor>>;
type Props = {
  documentId: string;
  editor: Editor;
  /** Number of proofs per source, when the proofs are known; the column is hidden otherwise. */
  proofCounts?: ReadonlyMap<string, number>;
  /** The assignment of the work: needed to read the style of the institution; without it the FPZG style is shown. */
  assignmentId?: string;
};

const MAX_FILE = 1_000_000;

export function StudentBibliographyHost(props: Props) {
  const [open, setOpen] = useState(false);
  return <Details summary={t.heading} onToggle={(event) => setOpen(event.currentTarget.open)}>
    {open && <Bibliography {...props} />}
  </Details>;
}

function Bibliography({ documentId, editor, proofCounts, assignmentId }: Props) {
  const [doc, setDoc] = useState(() => (editor.isDestroyed ? null : editor.state.doc));
  useEffect(() => {
    const sync = () => setDoc(editor.isDestroyed ? null : editor.state.doc);
    sync();
    editor.on("transaction", sync);
    return () => { editor.off("transaction", sync); };
  }, [editor]);
  const json = useMemo(() => (doc ? doc.toJSON() : null), [doc]);
  const sources = useMemo(() => bibSources(json), [json]);
  const places = useMemo(() => citePlaces(json), [json]);
  const stats = useMemo(() => sourceStats(sources, places, proofCounts ?? new Map()), [sources, places, proofCounts]);
  const reliance = useMemo(() => relianceNotes(sources, places), [sources, places]);
  const incomplete = useMemo(() => sources.map((s) => ({ s, missing: missingFields(s.raw) })).filter((x) => x.missing.length > 0), [sources]);
  const doubles = useMemo(() => possibleDuplicates(sources), [sources]);

  const [states, setStates] = useState<SourceStates>(() => readStates(documentId));
  const [filter, setFilter] = useState<"all" | "get" | "unread">("all");
  const [message, setMessage] = useState("");
  const [overviewOpen, setOverviewOpen] = useState(false);
  const cursor = useRef(new Map<string, number>());
  const editable = editor.isEditable && !editor.isDestroyed;

  useEffect(() => setStates(readStates(documentId)), [documentId]);

  const counts = stateCounts(sources.map((s) => s.id), states);
  const shown = stats.filter((s) => filter === "all" || (filter === "get" ? states[s.id] === "get"
    : states[s.id] !== undefined && states[s.id] !== "read"));

  const setState = (id: string, next: SourceState) => {
    const result = toggleState(states, id, next);
    setStates(result);
    writeStates(documentId, result);
  };

  const jump = (place: CitePlace | undefined) => {
    if (!place || editor.isDestroyed) return setMessage(t.jumpFailed);
    let n = -1;
    let at = -1;
    editor.state.doc.descendants((node, pos) => {
      if (node.type.name !== "citation") return at < 0;
      n += 1;
      if (n === place.index) at = pos;
      return false;
    });
    if (at < 0) return setMessage(t.jumpFailed);
    editor.view.dispatch(editor.state.tr.setSelection(TextSelection.near(editor.state.doc.resolve(at))).scrollIntoView());
    editor.commands.focus();
    setMessage("");
  };
  const next = (key: string, list: readonly CitePlace[]) => {
    const i = cursor.current.get(key) ?? 0;
    cursor.current.set(key, (i + 1) % Math.max(1, list.length));
    jump(list[i % Math.max(1, list.length)]);
  };

  if (sources.length === 0) return <div className={styles.content}>
    <p role="status">{t.empty}</p>
    <ImportRefs editor={editor} sources={sources} editable={editable} />
    <Unavailable />
  </div>;

  const cited = stats.filter((s) => s.places.length > 0).length;
  return <div className={styles.content}>
    <p>{proofCounts ? t.summary(sources.length, cited, stats.filter((s) => s.proofs > 0).length) : t.summaryNoProofs(sources.length, cited)}</p>
    <p><small>{t.stateDevice}</small></p>
    {counts.any && <div className={styles.row} role="group" aria-label={t.stateLabel}>
      {(["all", "get", "unread"] as const).map((f) =>
        <Button key={f} tone="quiet" aria-pressed={filter === f} onClick={() => setFilter(f)}>
          {f === "all" ? t.filterAll : f === "get" ? t.filterGet(counts.get) : t.filterUnread(counts.unread)}
        </Button>)}
    </div>}

    {reliance.map((r) => <section key={r.chapter} className={styles.card} aria-label={t.relianceTitle}>
      <strong>{t.relianceTitle}</strong>
      <p>{t.reliance(r.count, r.total, r.source.label)}</p>
      <Button tone="quiet" onClick={() => next(`rel:${r.chapter}`, places.filter((p) => p.chapter === r.chapter && p.sourceId === r.source.id))}>
        {t.relianceShow}
      </Button>
    </section>)}

    <ul className={styles.list}>
      {shown.map((s) => <li key={s.id} className={styles.item}>
        <strong>{s.label}</strong>
        <span>{s.title}</span>
        <small>{s.places.length ? t.cited(s.places.length) : t.notCited}</small>
        <div className={styles.row} role="group" aria-label={`${t.stateLabel}: ${s.label}`}>
          {([["get", t.stateGet], ["have", t.stateHave], ["read", t.stateRead]] as const).map(([v, label]) =>
            <Button key={v} tone="quiet" aria-pressed={states[s.id] === v} disabled={!editable}
              onClick={() => setState(s.id, v)}>{label}</Button>)}
        </div>
        {s.places.length > 0 && <Where places={s.places} onJump={jump} onNext={() => next(s.id, s.places)} />}
      </li>)}
    </ul>

    {(incomplete.length > 0 || doubles.length > 0) && <Details summary={t.incomplete(incomplete.length + doubles.length)}>
      <ul className={styles.list}>
        {incomplete.map(({ s, missing }) => <li key={`m${s.id}`} className={styles.item}>
          <strong>{s.label}</strong><small>{t.missing(missing.join(", "))}</small></li>)}
        {doubles.map(({ source, of }) => <li key={`d${source.id}`} className={styles.item}>
          <strong>{t.duplicate}</strong><small>{source.label}. {t.duplicateOf(of.label)}</small></li>)}
      </ul>
    </Details>}

    <Button tone="quiet" onClick={() => setOverviewOpen(true)}>{t.overview}</Button>
    <Overview open={overviewOpen} onClose={() => setOverviewOpen(false)} stats={stats} showProofs={Boolean(proofCounts)} />
    <ImportRefs editor={editor} sources={sources} editable={editable} />
    <StyledList json={json} sources={sources} assignmentId={assignmentId} />
    <Unavailable />
    <p role="status">{message}</p>
  </div>;
}

function Where({ places, onJump, onNext }: { places: readonly CitePlace[]; onJump: (p: CitePlace) => void; onNext: () => void }) {
  return <div className={styles.where}>
    <small>{t.where(places.length)}</small>
    <ul className={styles.list}>
      {places.slice(0, 3).map((p) => <li key={p.index}>
        <button type="button" className={styles.place} onClick={() => onJump(p)}>
          <b>{p.chapter ? t.chapter(p.chapter) : t.noChapter}</b> {p.sentence}
        </button>
      </li>)}
    </ul>
    {places.length > 3 && <Button tone="quiet" onClick={onNext}>{t.more(places.length - 3)}</Button>}
  </div>;
}

function Overview({ open, onClose, stats, showProofs }: { open: boolean; onClose: () => void; stats: ReturnType<typeof sourceStats>; showProofs: boolean }) {
  const rows = overviewRows(stats);
  return <Dialog open={open} title={t.overview} onClose={onClose} actions={<Button onClick={onClose}>{t.overviewClose}</Button>}>
    <p>{showProofs ? t.summary(rows.length, rows.filter((r) => r.cites > 0).length, rows.filter((r) => r.proofs > 0).length) : t.summaryNoProofs(rows.length, rows.filter((r) => r.cites > 0).length)}</p>
    <table className={styles.table}>
      <thead><tr><th scope="col">{t.colSource}</th><th scope="col">{t.colKind}</th><th scope="col">{t.colCites}</th>
        {showProofs && <th scope="col">{t.colProofs}</th>}</tr></thead>
      <tbody>{rows.map((r) => <tr key={r.id}><th scope="row">{r.label}</th><td>{r.kind}</td>
        <td>{r.cites || t.consulted}</td>{showProofs && <td>{r.proofs}</td>}</tr>)}</tbody>
    </table>
    <p><small>{t.overviewUnavailable}</small></p>
  </Dialog>;
}

type StyledProps = { json: Parameters<typeof styledLiterature>[0]; sources: readonly BibSource[] };

/** Without an assignment there is no institution style to read: the default FPZG style, no request. */
function StyledList({ assignmentId, ...rest }: StyledProps & { assignmentId: string | undefined }) {
  return assignmentId === undefined ? <StyledView {...rest} shown={defaultEffectiveStyle()} /> : <StyledLive {...rest} assignmentId={assignmentId} />;
}

function StyledLive({ assignmentId, ...rest }: StyledProps & { assignmentId: string }) {
  const read = useInstitutionStyle(assignmentId);
  return <StyledView {...rest} shown={effectiveStyle(read)} />;
}

function StyledView({ json, sources, shown }: StyledProps & { shown: EffectiveStyle }) {
  const out = useMemo(() => styledLiterature(json, shown.style), [json, shown.style]);
  const label = (id: string) => sources.find((s) => s.id === id)?.label ?? id;
  return <Details summary={t.styledTitle}>
    <div className={styles.content}>
      {shown.label && <p><strong>{shown.label}</strong></p>}
      {shown.note && <p role="status"><small>{shown.note}</small></p>}
      <p><small>{t.styledReadOnly}</small></p>
      {out.entries.length === 0 ? <p>{t.styledNone}</p> : <ol className={styles.list}>
        {out.entries.map((e) => <li key={e.sourceId} className={styles.item}>{e.text}</li>)}
      </ol>}
      {out.unformatted.length > 0 && <p><small>{t.styledUnformatted(out.unformatted.map(label).join("; "))}</small></p>}
      {out.orphanCitations > 0 && <p><small>{t.styledOrphans(out.orphanCitations)}</small></p>}
      {out.citations.length > 0 && <Details summary={`${t.styledInText} (${out.citations.length})`}>
        <ul className={styles.list}>
          {out.citations.map((c) => <li key={c.index}>{c.text} <small>{label(c.sourceId)}</small></li>)}
        </ul>
      </Details>}
    </div>
  </Details>;
}

function Unavailable() {
  return <Details summary={t.notYet}>
    <p><b>{t.recommended}.</b> {t.recommendedUnavailable}</p>
    <p><b>{t.mandatory}.</b> {t.mandatoryUnavailable}</p>
  </Details>;
}

function ImportRefs({ editor, sources, editable }: { editor: Editor; sources: readonly BibSource[]; editable: boolean }) {
  const [text, setText] = useState("");
  const [result, setResult] = useState("");
  const [scan, setScan] = useState<ScanResult | "busy" | null>(null);
  const supported = !editor.isDestroyed && Array.isArray(editor.state.doc.attrs.sources);

  const run = () => {
    if (editor.isDestroyed || !editor.isEditable || !supported) return;
    const plan = planImport(text, sources.map((s) => s.raw), () => crypto.randomUUID(), new Date().toISOString().slice(0, 10));
    if (plan.kind === "none") return setResult(t.importNone);
    if (plan.added.length > 0) {
      const all = [...(editor.state.doc.attrs.sources as unknown[]), ...plan.added];
      editor.view.dispatch(editor.state.tr.setDocAttribute("sources", all));
    }
    setResult(t.imported(plan.added.length, plan.skippedDuplicates) + (plan.incomplete ? t.importedIncomplete(plan.incomplete) : ""));
    if (plan.added.length > 0) setText("");
  };
  const readFile = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > MAX_FILE) return setResult(t.importTooLarge);
    try { setText(await file.text()); setResult(""); } catch { setResult(t.importFileFailed); }
  };
  const scanFile = async (file: File | undefined) => {
    if (!file) return;
    setScan("busy");
    setScan(await scanBarcode(file));
  };

  return <Details summary={t.importTitle}>
    {!supported ? <p>{t.importUnavailable}</p> : !editable ? <p>{t.importReadOnly}</p> : <div className={styles.content}>
      <p>{t.importIntro}</p>
      <TextArea label={t.importText} value={text} rows={6} onChange={(e) => { setText(e.currentTarget.value); setResult(""); }} />
      <label className={styles.file}>{t.importFile}
        <input type="file" accept=".bib,.ris,.txt" onChange={(e) => void readFile(e.currentTarget.files?.[0])} /></label>
      <Button disabled={text.trim() === ""} onClick={run}>{t.importRun}</Button>
      <p role="status">{result}</p>
      <label className={styles.file}>{t.scan}
        <input type="file" accept="image/*" capture="environment" onChange={(e) => void scanFile(e.currentTarget.files?.[0])} /></label>
      <p role="status">{scan === "busy" ? t.scanBusy : scan === null ? "" : scan.kind === "isbn" ? t.scanFound(scan.isbn)
        : scan.kind === "unsupported" ? t.scanUnsupported : scan.kind === "none" ? t.scanNone : t.scanFailed}</p>
    </div>}
  </Details>;
}
