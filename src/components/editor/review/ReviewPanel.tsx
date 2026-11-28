"use client";

/**
 * The Pregled card of the right panel (WEB-1102, E§3.5 review2): findings of
 * the text checks for the whole work or one chapter, a jump to the finding,
 * "nije greška" with a way back, and "Sažetak rada na jednoj stranici". The
 * findings and the summary are made again from the document every time it
 * changes. Advice stays advice (a "Savjet" row); nothing here edits the work.
 * The server gives only the enabled check ids (`enabledCheckIds`); `null`
 * means none were read, and every check of this build runs.
 */

import { useEffect, useMemo, useState } from "react";
import { Button, CheckActionList, Dialog, Select } from "@ductura/ui";
import { useEditorState, type Editor } from "@tiptap/react";
import { blockPosition } from "@/editor";

import { runChecks, type Finding } from "./checks";
import { digestOf } from "./digest";
import { ignore, kindCounts, kindsOff, readIgnored, restore, splitIgnored, toggleKind, writeIgnored } from "./ignored";
import { reviewMessagesHr as t } from "./messages.hr";
import { readReviewDoc } from "./model";
import { inScope, validScope, WHOLE_WORK, type Scope } from "./scope";
import { ACTION_GO, ACTION_IGNORE, digestText, detailOf, rowsOf, scopeLine, summaryLine, type DigestExtras } from "./view";

export type ReviewPanelProps = DigestExtras & {
  editor: Editor | null;
  /** The work; the "nije greška" marks are kept per work in this browser. */
  documentId: string;
  /** Check ids the institution enabled; null when none were read. */
  enabledCheckIds: readonly string[] | null;
  /** The config is still being read. */
  loading?: boolean;
};

const storage = (): Storage | null => { try { return typeof localStorage === "undefined" ? null : localStorage; } catch { return null; } };

/** Puts the cursor in the block of the finding, found by its id now (not the position it was drawn with). */
export function jumpTo(editor: Editor, finding: Finding): boolean {
  if (editor.isDestroyed) return false;
  const pos = finding.blockId ? blockPosition(editor.state.doc, finding.blockId) : finding.pos < editor.state.doc.content.size ? finding.pos : null;
  if (pos === null) return false;
  editor.chain().setTextSelection(pos + 1).scrollIntoView().run();
  editor.view.focus();
  return true;
}

export function ReviewPanel({ editor, documentId, enabledCheckIds, loading = false, question, wordRange }: ReviewPanelProps) {
  const doc = useEditorState({ editor, selector: ({ editor: e }) => (e && !e.isDestroyed ? e.state.doc : null), equalityFn: (a, b) => a === b });
  const model = useMemo(() => (doc ? readReviewDoc(doc) : null), [doc]);
  const all = useMemo(() => (model ? runChecks(model, enabledCheckIds) : []), [model, enabledCheckIds]);
  const [scope, setScope] = useState<Scope>(WHOLE_WORK);
  const [marked, setMarked] = useState<string[]>([]);
  const [digestOpen, setDigestOpen] = useState(false);
  const [copyNote, setCopyNote] = useState<string | null>(null);
  const [kindNote, setKindNote] = useState<string | null>(null);
  useEffect(() => { setMarked(readIgnored(storage(), documentId)); setKindNote(null); }, [documentId]);
  if (!editor || editor.isDestroyed || !model) return null;

  const current = validScope(model, scope);
  const { open, ignored } = splitIgnored(all, marked);
  const shown = open.filter((finding) => inScope(model, current, finding));
  const shownIgnored = ignored.filter((finding) => inScope(model, current, finding));
  const mark = (next: string[]) => { setMarked(next); writeIgnored(storage(), documentId, next); };
  const kinds = kindCounts(shown);
  const off = kindsOff(marked);
  const flipKind = (kind: Finding["kind"]) => {
    const next = toggleKind(marked, kind);
    mark(next);
    setKindNote(kindsOff(next).includes(kind) ? t.kindOffDone : t.kindOnDone);
  };
  const digest = digestOf(model, open);
  const extras: DigestExtras = { question, wordRange };
  const copy = async () => {
    try { await navigator.clipboard.writeText(digestText(digest, extras)); setCopyNote(t.digest.copied); }
    catch { setCopyNote(t.digest.copyFailed); }
  };

  return (
    <section aria-label={t.title}>
      <p>{t.intro}</p>
      {loading && <p role="status">{t.loading}</p>}
      {!loading && enabledCheckIds === null && <p role="status">{t.configUnavailable}</p>}
      {!loading && enabledCheckIds !== null && enabledCheckIds.length === 0 && <p role="status">{t.noChecks}</p>}
      <Select label={t.scopeLabel} value={current.kind === "all" ? "" : current.id} placeholder={t.scopeAll}
        options={model.chapters.filter((c) => c.id !== null).map((c) => ({ value: c.id as string, label: t.scopeChapter.replace("{number}", c.number).replace("{title}", c.title) }))}
        onChange={(event) => setScope(event.target.value === "" ? WHOLE_WORK : { kind: "chapter", id: event.target.value })} />
      <p role="status">{summaryLine(shown.length, current.kind === "chapter")}</p>
      <CheckActionList findings={rowsOf(shown)} labels={{ list: t.list, empty: t.empty, required: t.required, advisory: t.advisory }}
        onAction={({ findingId, actionId }) => {
          const finding = shown.find((item) => item.id === findingId);
          if (!finding) return;
          if (actionId === ACTION_GO) jumpTo(editor, finding);
          if (actionId === ACTION_IGNORE) mark(ignore(marked, finding.key));
        }} />
      {shownIgnored.length > 0 && (
        <details>
          <summary>{t.ignoredTitle.replace("{n}", String(shownIgnored.length))}</summary>
          <ul>
            {shownIgnored.map((finding) => (
              <li key={finding.id}>
                {finding.excerpt} — {detailOf(finding)}{" "}
                <Button tone="quiet" onClick={() => mark(restore(marked, finding.key))}>{t.restore}</Button>
              </li>
            ))}
          </ul>
          <Button tone="quiet" onClick={() => mark(marked.filter((key) => !shownIgnored.some((finding) => finding.key === key)))}>{t.restoreAll}</Button>
        </details>
      )}
      {kinds.length > 0 && (
        <details data-review-kinds="">
          <summary>{t.kindsTitle}</summary>
          <ul>
            {kinds.map(({ kind, n }) => (
              <li key={kind}>
                {t.kindRow.replace("{kind}", t.kind[kind]).replace("{n}", String(n))}{" "}
                <Button tone="quiet" aria-label={t.kindOffLabel.replace("{kind}", t.kind[kind])} onClick={() => flipKind(kind)}>{t.kindOff}</Button>
              </li>
            ))}
          </ul>
        </details>
      )}
      {off.length > 0 && (
        <p data-review-kinds-off="">
          {t.kindsOff}{" "}
          {off.map((kind) => (
            <Button key={kind} tone="quiet" aria-label={t.kindOnLabel.replace("{kind}", t.kind[kind])} onClick={() => flipKind(kind)}>{t.kind[kind]}</Button>
          ))}
        </p>
      )}
      {kindNote && <p role="status">{kindNote}</p>}
      <Button tone="quiet" onClick={() => setDigestOpen(true)} aria-haspopup="dialog">{t.digestOpen}</Button>
      <Dialog open={digestOpen} title={t.digest.title} onClose={() => { setDigestOpen(false); setCopyNote(null); }}
        actions={<><Button tone="quiet" onClick={copy}>{t.digest.copy}</Button><Button onClick={() => { setDigestOpen(false); setCopyNote(null); }}>{t.digest.close}</Button></>}>
        <h3>{digest.title ?? t.digest.untitled}</h3>
        <dl>
          <dt>{t.digest.question}</dt><dd>{question?.trim() || t.digest.questionNone}</dd>
          <dt>{t.digest.scope}</dt><dd>{scopeLine(digest.words, wordRange)}</dd>
          <dt>{t.digest.hypotheses}</dt><dd>{digest.hypotheses.length === 0 ? t.digest.hypothesesNone : digest.hypotheses.join(", ")}</dd>
          <dt>{t.digest.conclusion}</dt><dd>{digest.conclusion ?? t.digest.conclusionNone}</dd>
          <dt>{t.digest.findings}</dt>
          <dd>{digest.open === 0 ? t.digest.findingsNone : t.digest.findingsLine.replace("{n}", String(digest.open)).replace("{required}", String(digest.openRequired))}</dd>
        </dl>
        <h4>{t.digest.structure}</h4>
        {digest.rows.length === 0 ? <p>{t.digest.structureNone}</p> : (
          <table>
            <thead><tr><th scope="col">{t.digest.chapter}</th><th scope="col">{t.digest.words}</th><th scope="col">{t.digest.citations}</th></tr></thead>
            <tbody>{digest.rows.map((row) => <tr key={row.number}><td>{row.number} {row.title}</td><td>{row.words}</td><td>{row.citations}</td></tr>)}</tbody>
          </table>
        )}
        <p>{t.digest.note}</p>
        {copyNote && <p role="status">{copyNote}</p>}
      </Dialog>
    </section>
  );
}
