"use client";

// WEB-2127 (paritet, desni panel): the group "Pregled" of the right panel with
// its three views, Nacrt (with "Poslušaj"), Pojmovnik and Provjere, and the
// scope "Ovo poglavlje" / "Cijeli rad" (prototype right.js, INVENTAR §3.1).
// Provjere is the existing ReviewPanel (it keeps its own chapter picker and
// "nije greška" marks). Nothing here edits the work or sends text anywhere.
import { useEffect, useMemo, useRef, useState } from "react";
import { Button, TextField } from "@ductura/ui";
import type { useLocalEditor } from "@/components/editor/LocalDocument";
import { listsStartWholeWork } from "@/components/editor/layout-prefs/preferences";

import { jumpToBlock } from "./jump";
import { ReviewPanel } from "../../../../../../src/components/editor/review/ReviewPanel";
import { readReviewDoc, type ReviewDoc } from "../../../../../../src/components/editor/review/model";
import { TextFixesPanel } from "../../../../../../src/components/editor/text-fixes/TextFixesPanel";
import { createReadAloud, READ_ALOUD_MAX_RATE, READ_ALOUD_MIN_RATE, type ReadAloudController, type ReadAloudState } from "../read-aloud/controller";
import { readAloudSupported } from "../read-aloud/support";
import { readAloudRate } from "../reading-settings/rate-store";
import { listProofs } from "../../../../../../src/client/source-proofs";
import { tiptapToCanonicalV4 } from "../../../../../editor-core/src/editor/interop-v4.ts";
import QuoteReviewCard from "../stem/QuoteReviewCard";
import type { EvidenceBySource } from "../stem/quote-check";
import { loadQuoteEvidence, quotedSources } from "./quote-evidence";
import { onPregledView, takePregledView, type PregledView } from "./pregled-view";

import { pregledHr as t, thousands } from "./messages.hr";
import { consistency, nextUse, numbersWithoutSource, quotations, repeatedWords, seams, sentenceStarts } from "./pregled-tools";
import nacrt from "./Nacrt.module.css";
import {
  abbreviations, addTerm, chapterAt, frequentWords, listenText, loadTerms, nextTermPlace, outlineRows, removeTerm, saveTerms, termCounts,
  WHOLE, MAX_DEFINITION_LENGTH, MAX_TERM_LENGTH, type PregledScope, type Term, type TermStorage,
} from "./pregled-model";
import { blockTextAt, sentenceShape } from "./sentence-shape";

type Editor = NonNullable<ReturnType<typeof useLocalEditor>>;
// ED-73, ED-74: "oblik" and the five sub views are views of this group only; the Prikaz menu (pregled-view) asks for the first three.
type View = PregledView | "oblik" | "savovi" | "ponavljanja" | "dosljednost" | "brojke" | "navodi";
const VIEWS: readonly View[] = ["nacrt", "pojmovnik", "provjere", "oblik", "savovi", "ponavljanja", "dosljednost", "brojke", "navodi"];

const browserStorage = (): TermStorage | null => { try { return typeof window === "undefined" ? null : window.localStorage; } catch { return null; } };

export function PregledGroup({ editor, documentId, assignmentId, enabledCheckIds = null }: {
  editor: Editor | null | undefined;
  documentId: string;
  /** The work's assignment; without it the quote check (ED-40) is not shown. */
  assignmentId?: string;
  /** Check ids the institution enabled; null when none were read (every check of this build runs). */
  enabledCheckIds?: readonly string[] | null;
}) {
  const [view, setView] = useState<View>(() => takePregledView() ?? "nacrt");
  useEffect(() => onPregledView(setView), []);
  // ED-116: "Popisi prvo pokazuju" in the right panel's settings chooses where the lists open.
  const [wholeWork, setWholeWork] = useState(listsStartWholeWork);
  const snapshot = useEditorSnapshot(editor);
  const doc = useMemo(() => (snapshot ? readReviewDoc(snapshot.doc) : null), [snapshot?.doc]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!editor || !snapshot || !doc) return <p role="status">{t.unavailable}</p>;

  const here = chapterAt(doc, snapshot.from);
  const scope: PregledScope = wholeWork || here < 0 ? WHOLE : { kind: "chapter", index: here };
  return (
    <section aria-label={t.title} data-pregled="">
      <div role="group" aria-label={t.views}>
        {VIEWS.map((id) => <Button key={id} tone={view === id ? "primary" : "quiet"} aria-pressed={view === id} onClick={() => setView(id)}>{t[id]}</Button>)}
      </div>
      {view !== "provjere" && view !== "oblik" && <>
        <div role="group" aria-label={t.scope}>
          <Button tone="quiet" aria-pressed={!wholeWork} onClick={() => setWholeWork(false)}>{t.scopeChapter}</Button>
          <Button tone="quiet" aria-pressed={wholeWork} onClick={() => setWholeWork(true)}>{t.scopeWork}</Button>
        </div>
        {here < 0 && !wholeWork && <p role="status">{t.noChapter}</p>}
      </>}
      {view === "nacrt" && <Nacrt editor={editor} doc={doc} scope={scope} />}
      {view === "pojmovnik" && <Pojmovnik editor={editor} doc={doc} scope={scope} workId={documentId} />}
      {view === "savovi" && <Savovi editor={editor} doc={doc} scope={scope} />}
      {view === "ponavljanja" && <Ponavljanja editor={editor} doc={doc} scope={scope} />}
      {view === "dosljednost" && <Dosljednost editor={editor} doc={doc} scope={scope} />}
      {view === "brojke" && <Brojke editor={editor} doc={doc} scope={scope} />}
      {view === "navodi" && <Navodi editor={editor} doc={doc} scope={scope} />}
      {view === "oblik" && <OblikRecenica text={blockTextAt(doc, snapshot.from)} />}
      {view === "provjere" && <>
        <ReviewPanel editor={editor} documentId={documentId} enabledCheckIds={enabledCheckIds} />
        <TextFixesPanel editor={editor} documentId={documentId} enabledCheckIds={enabledCheckIds} />
        {assignmentId !== undefined && <QuoteCheck editor={editor} pmDoc={snapshot.doc} assignmentId={assignmentId} />}
      </>}
    </section>
  );
}

/**
 * ED-40 (P2-11): "Navodi prema izvoru" under Provjere. Only a work in schema v4 has the quotes and citations
 * the check reads; the notes of the quoted sources come through student.source-proofs.get (option 1).
 */
function QuoteCheck({ editor, pmDoc, assignmentId }: { editor: Editor; pmDoc: Editor["state"]["doc"]; assignmentId: string }) {
  const doc = useMemo(() => {
    const read = tiptapToCanonicalV4(editor.getJSON());
    return read.ok ? read.doc : null;
  }, [editor, pmDoc]); // eslint-disable-line react-hooks/exhaustive-deps
  const key = doc === null ? "" : quotedSources(doc).join(",");
  const [evidence, setEvidence] = useState<{ for: string; read: EvidenceBySource | null } | null>(null);
  useEffect(() => {
    if (doc === null) return;
    let live = true;
    void loadQuoteEvidence(key === "" ? [] : key.split(","), (sourceId) => listProofs(assignmentId, sourceId))
      .then((read) => { if (live) setEvidence({ for: key, read }); });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignmentId, key]);
  if (doc === null) return null;
  return <QuoteReviewCard doc={doc} evidence={evidence !== null && evidence.for === key ? evidence.read : null} />;
}

/** ED-73: "Oblik rečenica", one bar per sentence of the paragraph at the cursor (prototype features.js `bars`). */
function OblikRecenica({ text }: { text: string | null }) {
  const bars = text === null ? [] : sentenceShape(text);
  return (
    <div data-oblik-recenica="">
      <p>{t.shapeIntro}</p>
      {bars.length === 0 ? <p role="status">{t.shapeEmpty}</p> : (
        <ol aria-label={t.shapeList} style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {bars.map((bar) => (
            <li key={bar.index} aria-label={t.shapeBar(bar.index + 1, bar.words, bar.long)} data-long={bar.long ? "" : undefined}
              style={{ display: "flex", alignItems: "center", gap: 6, margin: "3px 0", fontSize: 11.5, color: "var(--ink-3)" }}>
              <i aria-hidden="true" style={{ display: "block", height: 8, minWidth: 4, borderRadius: 999,
                width: `${bar.width}%`, background: bar.long ? "var(--warn)" : "var(--accent)" }} />
              <span aria-hidden="true" style={{ fontVariantNumeric: "tabular-nums" }}>{bar.words}</span>
            </li>
          ))}
        </ol>
      )}
      <p>{t.shapeHint}</p>
    </div>
  );
}

/** The document and the cursor of the open editor, read again after every transaction. */
function useEditorSnapshot(editor: Editor | null | undefined): { doc: Editor["state"]["doc"]; from: number } | null {
  const read = () => (editor && !editor.isDestroyed ? { doc: editor.state.doc, from: editor.state.selection.from } : null);
  const [snapshot, setSnapshot] = useState(read);
  useEffect(() => {
    setSnapshot(read);
    if (!editor || editor.isDestroyed) return;
    const update = () => setSnapshot((prev) => {
      const next = read();
      return prev && next && prev.doc === next.doc && prev.from === next.from ? prev : next;
    });
    editor.on("transaction", update);
    return () => { editor.off("transaction", update); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]);
  return snapshot;
}

const RATES = [READ_ALOUD_MIN_RATE, 1, 1.25, READ_ALOUD_MAX_RATE] as const;

function Nacrt({ editor, doc, scope }: { editor: Editor; doc: NonNullable<ReturnType<typeof readReviewDoc>>; scope: PregledScope }) {
  const rows = useMemo(() => outlineRows(doc, scope), [doc, scope]);
  const text = useMemo(() => listenText(doc, scope), [doc, scope]);
  const [state, setState] = useState<ReadAloudState>("idle");
  const [supported, setSupported] = useState<boolean | null>(null);
  const [rate, setRate] = useState<number>(() => readAloudRate());
  const [fallback, setFallback] = useState(false);
  const [note, setNote] = useState("");
  const reader = useRef<ReadAloudController | null>(null);
  useEffect(() => {
    setSupported(readAloudSupported());
    const controller = createReadAloud({ onStateChange: setState }, undefined, rate);
    reader.current = controller;
    return () => { reader.current = null; controller.stop(); };
  }, []);
  // A different scope is a different text: the reading of the old one stops.
  useEffect(() => { reader.current?.stop(); setNote(""); }, [scope]);

  const active = state === "reading" || state === "paused";
  const toggle = () => {
    const controller = reader.current;
    if (!controller) return;
    if (active) { controller.stop(); return; }
    const started = controller.start(text);
    setNote(started ? "" : t.listenEmpty);
    setFallback(started && controller.voiceFallback);
  };
  const pauseOrResume = () => { if (state === "paused") reader.current?.resume(); else reader.current?.pause(); };
  const changeRate = (value: string) => { const next = Number(value); setRate(next); reader.current?.setRate(next); };
  return (
    <div>
      <p>{t.nacrtIntro}</p>
      {supported
        ? (
          <div>
            <Button tone="quiet" aria-pressed={active} onClick={toggle}>{active ? t.listenStop : t.listen}</Button>
            {active && <Button tone="quiet" aria-pressed={state === "paused"} onClick={pauseOrResume}>{state === "paused" ? t.listenResume : t.listenPause}</Button>}
            <label>{t.listenRate}{" "}
              <select value={rate} onChange={(e) => changeRate(e.currentTarget.value)}>
                {RATES.map((r) => <option key={r} value={r}>{t.listenRateValue(r)}</option>)}
              </select>
            </label>
          </div>
        )
        : supported === false && <p role="status">{t.listenUnsupported}</p>}
      {supported && <p>{t.listenLocal}</p>}
      {fallback && active && <p role="status">{t.listenVoiceFallback}</p>}
      {note && <p role="status">{note}</p>}
      {rows.length === 0 ? <p>{t.nacrtEmpty}</p> : (
        <ol className={nacrt.list} data-nacrt>
          {rows.map((row, i) => (
            <li key={row.key}>
              {row.chapter !== null && row.chapter !== rows[i - 1]?.chapter && <strong className={nacrt.heading}>{row.chapter}</strong>}
              <button type="button" className={nacrt.row} onClick={() => jumpToBlock(editor, row.pos)}>
                {row.shown}
                {row.long && <span className={nacrt.tag} title={t.longFirst(row.words)}>{t.longFirstTag(row.words)}</span>}
                <span className={nacrt.meta}>
                  <span>{t.words(row.paragraphWords)}</span>
                  <span>{t.citations(row.citations)}</span>
                  {row.flags.map((flag) => <span key={flag} className={nacrt.flag}>{t.flags[flag]}</span>)}
                </span>
              </button>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function Pojmovnik({ editor, doc, scope, workId }: { editor: Editor; doc: NonNullable<ReturnType<typeof readReviewDoc>>; scope: PregledScope; workId: string }) {
  const [storage] = useState(browserStorage);
  const where = (name: string) => {
    const pos = nextTermPlace(doc, scope, name, editor.state.selection.from);
    if (pos !== null) jumpToBlock(editor, pos);
  };
  const [terms, setTerms] = useState<Term[]>([]);
  const [term, setTerm] = useState("");
  const [definition, setDefinition] = useState("");
  const [problem, setProblem] = useState<"duplicate" | "full" | "storage" | null>(null);
  useEffect(() => { setTerms(loadTerms(storage, workId)); }, [storage, workId]);

  const counts = useMemo(() => termCounts(doc, scope, terms.map((x) => x.term)), [doc, scope, terms]);
  const frequent = useMemo(() => frequentWords(doc, scope), [doc, scope]);
  const abbrs = useMemo(() => abbreviations(doc, scope), [doc, scope]);

  const commit = (next: Term[]) => { setTerms(next); setProblem(saveTerms(storage, workId, next) ? null : "storage"); };
  const add = (name: string, meaning: string) => {
    const result = addTerm(terms, name, meaning);
    if (!result.ok) { if (result.reason !== "empty") setProblem(result.reason); return false; }
    commit(result.terms);
    return true;
  };
  return (
    <div>
      <p>{t.glossaryIntro}</p>
      <form onSubmit={(e) => { e.preventDefault(); if (add(term, definition)) { setTerm(""); setDefinition(""); } }}>
        <TextField label={t.termLabel} maxLength={MAX_TERM_LENGTH} value={term} onChange={(e) => setTerm(e.target.value)} />
        <TextField label={t.definitionLabel} maxLength={MAX_DEFINITION_LENGTH} value={definition} onChange={(e) => setDefinition(e.target.value)} />
        <Button type="submit" tone="quiet">{t.add}</Button>
      </form>
      {problem && <p role="status">{problem === "duplicate" ? t.duplicate : problem === "full" ? t.maxTerms : t.storageOff}</p>}
      <h3>{t.termsTitle}</h3>
      {terms.length === 0 ? <p>{t.noTerms}</p> : (
        <ul>
          {terms.map((x) => (
            <li key={x.term}>
              <strong>{x.term}</strong>{x.definition && <> — {x.definition}</>}
              <br /><small>{counts[x.term] ? t.termCount(counts[x.term]!) : t.termAbsent}</small>{" "}
              {counts[x.term] ? <Button tone="quiet" aria-label={t.termWhereLabel(x.term)} onClick={() => where(x.term)}>{t.termWhere}</Button> : null}{" "}
              <Button tone="quiet" aria-label={`${t.remove}: ${x.term}`} onClick={() => commit(removeTerm(terms, x.term))}>{t.remove}</Button>
            </li>
          ))}
        </ul>
      )}
      <h3>{t.frequent}</h3>
      {frequent.length === 0 ? <p>{t.frequentEmpty}</p> : <ul>{frequent.map((f) => <li key={f.word}>{f.word} <small>{t.times(f.count)}</small></li>)}</ul>}
      <h3>{t.abbreviations}</h3>
      {abbrs.length === 0 ? <p>{t.abbreviationsEmpty}</p> : (
        <ul>
          {abbrs.map((a) => (
            <li key={a.abbreviation}>
              {a.abbreviation} <small>{t.times(a.count)}</small>{" "}
              {!terms.some((x) => x.term === a.abbreviation) && <Button tone="quiet" aria-label={`${t.abbreviationAdd}: ${a.abbreviation}`} onClick={() => add(a.abbreviation, "")}>{t.abbreviationAdd}</Button>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ED-74: the five tools of the prototype's Pregled (tools.js, review2.js). Each row jumps to its paragraph.
type ToolProps = { editor: Editor; doc: ReviewDoc; scope: PregledScope };

function Savovi({ editor, doc, scope }: ToolProps) {
  const list = useMemo(() => seams(doc, scope), [doc, scope]);
  const side = (label: string, s: { sentence: string | null; pos: number | null }) => <>
    <h4>{label}</h4>
    {s.sentence !== null && s.pos !== null
      ? <button type="button" onClick={() => jumpToBlock(editor, s.pos!)}>{s.sentence}</button>
      : <p>{t.seamNoText}</p>}
  </>;
  return (
    <div>
      <p>{t.seamIntro}</p>
      {list.length === 0 ? <p>{t.seamNone}</p> : list.map((seam) => (
        <div key={seam.key} data-seam="">
          {side(t.seamEnd(seam.end.chapter), seam.end)}
          {side(t.seamStart(seam.start.chapter), seam.start)}
        </div>
      ))}
    </div>
  );
}

function Ponavljanja({ editor, doc, scope }: ToolProps) {
  const starts = useMemo(() => sentenceStarts(doc, scope), [doc, scope]);
  const words = useMemo(() => repeatedWords(doc, scope), [doc, scope]);
  const find = (key: string) => {
    const pos = nextUse(doc, key, editor.state.selection.from);
    if (pos !== null) jumpToBlock(editor, pos);
  };
  return (
    <div>
      <p>{t.repIntro}</p>
      <h3>{t.repStarts}</h3>
      {starts.length === 0 ? <p>{t.repStartsNone}</p> : (
        <ul>
          {starts.map((s) => (
            <li key={s.word}>
              <button type="button" onClick={() => jumpToBlock(editor, s.pos)}><strong>{s.word}…</strong> <small>{t.repStartCount(s.count)}</small></button>
            </li>
          ))}
        </ul>
      )}
      <h3>{t.repWords}</h3>
      {words.length === 0 ? <p>{t.repWordsNone}</p> : (
        <div role="group" aria-label={t.repWords}>
          {words.map((w) => <Button key={w.key} tone="quiet" title={t.repWordFind} onClick={() => find(w.key)}>{w.word} {t.times(w.count)}</Button>)}
        </div>
      )}
      <p>{t.repWordsNote}</p>
    </div>
  );
}

function Dosljednost({ editor, doc, scope }: ToolProps) {
  const { mixed, consistent } = useMemo(() => consistency(doc, scope), [doc, scope]);
  return (
    <div>
      <p>{t.dosIntro}</p>
      {mixed.length === 0 ? <p>{t.dosNone}</p> : mixed.map((c) => (
        <div key={c.name} data-consistency="">
          <h4>{c.name}</h4>
          <p><small>{t.dosWays(c.forms.length)}</small></p>
          <ul>
            {c.forms.map((f) => (
              <li key={f.form}><button type="button" onClick={() => jumpToBlock(editor, f.pos)}><strong>{f.form}</strong> <small>{t.times(f.count)}</small></button></li>
            ))}
          </ul>
        </div>
      ))}
      {mixed.length > 0 && consistent.length > 0 && <p>{t.dosOk(consistent)}</p>}
    </div>
  );
}

function Brojke({ editor, doc, scope }: ToolProps) {
  const rows = useMemo(() => numbersWithoutSource(doc, scope), [doc, scope]);
  return (
    <div>
      <p>{t.numIntro}</p>
      {rows.length === 0 ? <p>{t.numNone}</p> : (
        <ul>
          {rows.map((r) => (
            <li key={r.key}><button type="button" onClick={() => jumpToBlock(editor, r.pos)}><strong>{r.number}</strong> <span>{r.sentence}</span></button></li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Navodi({ editor, doc, scope }: ToolProps) {
  const q = useMemo(() => quotations(doc, scope), [doc, scope]);
  const row = (x: (typeof q.list)[number]) => (
    <li key={x.key}><button type="button" onClick={() => jumpToBlock(editor, x.pos)}><strong>{t.quoWords(x.words, x.block)}</strong> <span>{x.text}</span></button></li>
  );
  return (
    <div>
      <div data-quote-share="">
        <p><strong>{t.quoShare(thousands(q.quoted), thousands(q.total))}</strong></p>
        <p>{t.quoCount(q.list.length)}</p>
      </div>
      {q.long.length > 0 && <><h3>{t.quoLong(q.long.length)}</h3><ul>{q.long.map(row)}</ul></>}
      <h3>{t.quoLongest}</h3>
      {q.longest.length === 0 ? <p>{t.quoNone}</p> : <ul>{q.longest.map(row)}</ul>}
    </div>
  );
}
