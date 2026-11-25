"use client";

// WEB-2127 (paritet, desni panel): the group "Pregled" of the right panel with
// its three views, Nacrt (with "Poslušaj"), Pojmovnik and Provjere, and the
// scope "Ovo poglavlje" / "Cijeli rad" (prototype right.js, INVENTAR §3.1).
// Provjere is the existing ReviewPanel (it keeps its own chapter picker and
// "nije greška" marks). Nothing here edits the work or sends text anywhere.
import { useEffect, useMemo, useRef, useState } from "react";
import { Button, TextField } from "@ductura/ui";
import type { useLocalEditor } from "@/components/editor/LocalDocument";

import { jumpToBlock } from "./jump";
import { ReviewPanel } from "../../../../../../src/components/editor/review/ReviewPanel";
import { readReviewDoc } from "../../../../../../src/components/editor/review/model";
import { readAloud, speechSupport, stopReading } from "../../../../../../src/components/editor/addons/speech";

import { pregledHr as t } from "./messages.hr";
import {
  abbreviations, addTerm, chapterAt, frequentWords, listenText, loadTerms, outlineRows, removeTerm, saveTerms, termCounts,
  WHOLE, MAX_DEFINITION_LENGTH, MAX_TERM_LENGTH, type PregledScope, type Term, type TermStorage,
} from "./pregled-model";

type Editor = NonNullable<ReturnType<typeof useLocalEditor>>;
type View = "nacrt" | "pojmovnik" | "provjere";
const VIEWS: readonly View[] = ["nacrt", "pojmovnik", "provjere"];

const browserStorage = (): TermStorage | null => { try { return typeof window === "undefined" ? null : window.localStorage; } catch { return null; } };

export function PregledGroup({ editor, documentId, enabledCheckIds = null }: {
  editor: Editor | null | undefined;
  documentId: string;
  /** Check ids the institution enabled; null when none were read (every check of this build runs). */
  enabledCheckIds?: readonly string[] | null;
}) {
  const [view, setView] = useState<View>("nacrt");
  const [wholeWork, setWholeWork] = useState(false);
  const snapshot = useEditorSnapshot(editor);
  const doc = useMemo(() => (snapshot ? readReviewDoc(snapshot.doc) : null), [snapshot?.doc]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!editor || !snapshot || !doc) return <p role="status">{t.unavailable}</p>;

  const here = chapterAt(doc, snapshot.from);
  const scope: PregledScope = wholeWork || here < 0 ? WHOLE : { kind: "chapter", index: here };
  return (
    <section aria-label={t.title} data-pregled="">
      <div className="segmented" role="group" aria-label={t.views}>
        {VIEWS.map((id) => <Button key={id} tone="segment" aria-pressed={view === id} onClick={() => setView(id)}>{t[id]}</Button>)}
      </div>
      {view !== "provjere" && <>
        <div className="segmented" role="group" aria-label={t.scope}>
          <Button tone="segment" aria-pressed={!wholeWork} onClick={() => setWholeWork(false)}>{t.scopeChapter}</Button>
          <Button tone="segment" aria-pressed={wholeWork} onClick={() => setWholeWork(true)}>{t.scopeWork}</Button>
        </div>
        {here < 0 && !wholeWork && <p role="status">{t.noChapter}</p>}
      </>}
      {view === "nacrt" && <Nacrt editor={editor} doc={doc} scope={scope} />}
      {view === "pojmovnik" && <Pojmovnik doc={doc} scope={scope} workId={documentId} />}
      {view === "provjere" && <ReviewPanel editor={editor} documentId={documentId} enabledCheckIds={enabledCheckIds} />}
    </section>
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

function Nacrt({ editor, doc, scope }: { editor: Editor; doc: NonNullable<ReturnType<typeof readReviewDoc>>; scope: PregledScope }) {
  const rows = useMemo(() => outlineRows(doc, scope), [doc, scope]);
  const text = useMemo(() => listenText(doc, scope), [doc, scope]);
  const [support, setSupport] = useState<{ reading: boolean } | null>(null);
  const [listening, setListening] = useState(false);
  const [note, setNote] = useState("");
  const live = useRef(true);
  useEffect(() => { live.current = true; setSupport(speechSupport()); return () => { live.current = false; stopReading(); }; }, []);
  useEffect(() => { stopReading(); setListening(false); }, [scope]);

  const toggle = () => {
    if (listening) { stopReading(); setListening(false); return; }
    const started = readAloud(text, () => { if (live.current) setListening(false); });
    setNote(started ? "" : t.listenEmpty);
    setListening(started);
  };
  return (
    <div>
      <p>{t.nacrtIntro}</p>
      {support?.reading
        ? <Button tone="quiet" aria-pressed={listening} onClick={toggle}>{listening ? t.listenStop : t.listen}</Button>
        : support && <p role="status">{t.listenUnsupported}</p>}
      {support?.reading && <p>{t.listenLocal}</p>}
      {note && <p role="status">{note}</p>}
      {rows.length === 0 ? <p>{t.nacrtEmpty}</p> : (
        <ol>
          {rows.map((row, i) => (
            <li key={row.key}>
              {row.chapter !== null && row.chapter !== rows[i - 1]?.chapter && <strong>{row.chapter}</strong>}
              <button type="button" onClick={() => jumpToBlock(editor, row.pos)}>{row.sentence}</button>
              <small> {t.words(row.words)}{row.long ? ` · ${t.longFirst}` : ""}</small>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function Pojmovnik({ doc, scope, workId }: { doc: NonNullable<ReturnType<typeof readReviewDoc>>; scope: PregledScope; workId: string }) {
  const [storage] = useState(browserStorage);
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
