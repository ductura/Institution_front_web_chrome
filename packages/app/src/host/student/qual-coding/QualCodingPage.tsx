"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { Button, Card, Dialog, RouteLoading, Select, Tag, TextArea, TextField } from "@ductura/ui";

import { createApi, goToSignIn } from "@/client/api";
import { appHref } from "../../../../../../src/components/shell/nav";
import { useHost } from "../../context";
import { readMaterial, type OneRead } from "../qual-materials/read";
import { linesOf } from "../qual-materials/model";
import { qualCodingText as t } from "./messages.hr";
import { checkCode, checkMark, countText, orderSegments, wholeParagraph, type CodeError, type MarkError, type Selection } from "./model";
import {
  addCode, addSegment, patchCode, readCodes, readSegments, removeCode, removeSegment,
  type Code, type CodesRead, type SegmentsRead,
} from "./read";

type Api = ReturnType<typeof createApi>;
const defaultCall = (): Api => createApi();
const ID = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
type Note = { tone: "status" | "alert"; text: string };

/** The route's page: the material comes from `?gradivo=`; a missing or malformed id is "not chosen", never a call. */
export default function QualCodingRoute({ call = defaultCall }: { call?: () => Api }) {
  const id = useSearchParams().get("gradivo");
  return <QualCodingPage materialId={id !== null && ID.test(id) ? id : null} call={call} />;
}

/**
 * Student: "Kodiranje" (WEB-V18-KODIRANJE-OZNAKE). The student's own codebook (add, rename, order, delete), marking a
 * passage of one material and giving it a code, and reviewing and removing what is marked. Private to the student;
 * another's material, code or passage is "not found". No suggestion of codes and no call to the helper (V18-3).
 * Loading, error and empty are three different states; a note of success follows only the server's answer.
 */
export function QualCodingPage({ materialId, call = defaultCall }: { materialId: string | null; call?: () => Api }) {
  const { base } = useHost();
  const here = appHref(base, materialId === null ? "/zadaci/kodiranje" : `/zadaci/kodiranje?gradivo=${materialId}`);
  const [material, setMaterial] = useState<OneRead | null>(null);
  const [codes, setCodes] = useState<CodesRead | null>(null);
  const [segments, setSegments] = useState<SegmentsRead | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [note, setNote] = useState<Note | null>(null);
  const [busy, setBusy] = useState(false);

  const lost = useCallback((r: { kind: string }) => { if (r.kind === "signedOut") { goToSignIn(here); return true; } return false; }, [here]);

  useEffect(() => {
    if (materialId === null) return;
    let live = true;
    void Promise.all([readMaterial(call(), materialId), readCodes(call()), readSegments(call(), materialId)]).then(([m, c, s]) => {
      if (!live) return;
      if (lost(m) || lost(c) || lost(s)) return;
      setMaterial(m); setCodes(c); setSegments(s);
    });
    return () => { live = false; };
    // `call`, `materialId` and `lost` are stable per visit; the attempt is what asks again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt, materialId]);

  // After a write both lists are read again while the forms stay locked, so a lost answer cannot be retried
  // before the page knows whether the server kept it.
  async function reconcile() {
    if (materialId === null) return;
    const [c, s] = await Promise.all([readCodes(call()), readSegments(call(), materialId)]);
    if (lost(c) || lost(s)) return;
    setCodes(c); setSegments(s);
  }

  const back = <p><a href={appHref(base, "/zadaci/gradivo-kodiranja")}><span aria-hidden="true">← </span>{t.back}</a></p>;
  const head = <header><h1>{t.title}</h1><p>{t.lead}</p></header>;

  if (materialId === null) return <div className="page">{back}{head}<Card level={2} title={t.noMaterial.title}><p>{t.noMaterial.body}</p></Card></div>;
  if (material === null || codes === null || segments === null) return <div className="page">{back}{head}<RouteLoading label={t.loading} /></div>;
  if (material.kind === "notFound" || segments.kind === "notFound") return <div className="page">{back}{head}<Card level={2} title={t.gone.title}><p>{t.gone.body}</p></Card></div>;
  if (material.kind !== "ok" || codes.kind !== "ok" || segments.kind !== "ok") {
    return (
      <div className="page">{back}{head}
        <Card level={2} title={t.title}><p role="alert">{t.unavailable}</p><p><Button tone="quiet" onClick={() => { setMaterial(null); setCodes(null); setSegments(null); setAttempt((n) => n + 1); }}>{t.retry}</Button></p></Card>
      </div>
    );
  }
  const lines = linesOf(material.material.text);
  return (
    <div className="page">
      {back}{head}
      <h2>{material.material.title}</h2>
      {note !== null && (note.tone === "alert" ? <p role="alert">{note.text}</p> : <p role="status">{note.text}</p>)}
      <Codebook
        codes={codes.codes} busy={busy} setBusy={setBusy} call={call} setNote={setNote} lost={lost} reconcile={reconcile}
      />
      <Marking
        materialId={materialId} lines={lines} codes={codes.codes} busy={busy} setBusy={setBusy} call={call} setNote={setNote} lost={lost} reconcile={reconcile}
      />
      <Segments
        codes={codes.codes} segments={segments.segments} busy={busy} setBusy={setBusy} call={call} setNote={setNote} lost={lost} reconcile={reconcile}
      />
    </div>
  );
}

type Shared = {
  busy: boolean; setBusy: (b: boolean) => void; call: () => Api; setNote: (n: Note | null) => void;
  lost: (r: { kind: string }) => boolean; reconcile: () => Promise<void>;
};

function Codebook({ codes, busy, setBusy, call, setNote, lost, reconcile }: Shared & { codes: readonly Code[] }) {
  const [draft, setDraft] = useState({ name: "", description: "" });
  const [error, setError] = useState<{ field: string; error: CodeError } | null>(null);
  const [editing, setEditing] = useState<{ id: string; name: string; description: string } | null>(null);
  const [editError, setEditError] = useState<CodeError | null>(null);
  const [asking, setAsking] = useState<Code | null>(null);
  const fieldError = (field: string) => (error?.field === field ? t.errors[error.error] : undefined);

  const failure = (kind: string) =>
    kind === "notFound" ? t.codeGone : kind === "conflict" ? t.codeConflict : kind === "invalid" ? t.codeInvalid : t.codeUnknown;

  async function add(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setNote(null);
    const checked = checkCode(draft, codes);
    if (!checked.ok) { setError({ field: checked.field, error: checked.error }); return; }
    setError(null);
    setBusy(true);
    const outcome = await addCode(call(), checked.value);
    if (lost(outcome)) { setBusy(false); return; }
    if (outcome.kind === "saved") { setNote({ tone: "status", text: t.codeAdded }); setDraft({ name: "", description: "" }); }
    else setNote({ tone: "alert", text: failure(outcome.kind) });
    await reconcile();
    setBusy(false);
  }

  async function saveEdit(event: FormEvent) {
    event.preventDefault();
    if (busy || editing === null) return;
    setNote(null);
    const checked = checkCode(editing, codes, editing.id);
    if (!checked.ok) { setEditError(checked.error); return; }
    setEditError(null);
    setBusy(true);
    const outcome = await patchCode(call(), editing.id, { name: checked.value.name, description: checked.value.description ?? "" });
    if (lost(outcome)) { setBusy(false); return; }
    if (outcome.kind === "saved") { setNote({ tone: "status", text: t.codeSaved }); setEditing(null); }
    else setNote({ tone: "alert", text: failure(outcome.kind) });
    await reconcile();
    setBusy(false);
  }

  /** The code takes the place of its neighbour; the codebook is read again and shown as the server keeps it. */
  async function move(index: number, delta: -1 | 1) {
    const code = codes[index];
    const neighbour = codes[index + delta];
    if (busy || code === undefined || neighbour === undefined) return;
    setNote(null);
    setBusy(true);
    const outcome = await patchCode(call(), code.id, { order: neighbour.order });
    if (lost(outcome)) { setBusy(false); return; }
    setNote(outcome.kind === "saved" ? { tone: "status", text: t.codeMoved } : { tone: "alert", text: failure(outcome.kind) });
    await reconcile();
    setBusy(false);
  }

  async function remove(code: Code, confirm: boolean) {
    if (busy) return;
    setBusy(true);
    const outcome = await removeCode(call(), code.id, confirm);
    if (lost(outcome)) { setBusy(false); return; }
    if (outcome.kind === "needsConfirm") { setAsking(code); setBusy(false); return; }
    setAsking(null);
    if (editing?.id === code.id) setEditing(null);
    if (outcome.kind === "removed") setNote({ tone: "status", text: t.codeRemoved });
    else setNote({ tone: "alert", text: outcome.kind === "notFound" ? t.codeGone : t.codeUnknown });
    await reconcile();
    setBusy(false);
  }

  return (
    <Card level={2} title={t.codebookTitle}>
      {codes.length === 0 ? <><h3>{t.noCodes.title}</h3><p>{t.noCodes.body}</p></> : (
        <ol>
          {codes.map((code, index) => (
            <li key={code.id} data-testid="code">
              {editing?.id === code.id ? (
                <form onSubmit={(event) => void saveEdit(event)} noValidate>
                  <TextField label={t.codeName} value={editing.name} busy={busy} error={editError === null || editError === "descriptionTooLong" || editError === "descriptionInvalid" ? undefined : t.errors[editError]}
                    onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
                  <TextArea label={t.codeDescription} value={editing.description} busy={busy} error={editError === "descriptionTooLong" || editError === "descriptionInvalid" ? t.errors[editError] : undefined}
                    onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
                  <p><Button type="submit" busy={busy}>{t.codeSave}</Button>{" "}<Button tone="quiet" disabled={busy} onClick={() => { setEditing(null); setEditError(null); }}>{t.codeCancel}</Button></p>
                </form>
              ) : (
                <>
                  <strong>{code.name}</strong>{code.description !== "" && <> — <span>{code.description}</span></>}
                  <br />
                  <Button tone="quiet" disabled={busy || index === 0} aria-label={t.codeUpAria.replace("{name}", code.name)} onClick={() => void move(index, -1)}>{t.codeUp}</Button>{" "}
                  <Button tone="quiet" disabled={busy || index === codes.length - 1} aria-label={t.codeDownAria.replace("{name}", code.name)} onClick={() => void move(index, 1)}>{t.codeDown}</Button>{" "}
                  <Button tone="quiet" disabled={busy} aria-label={t.codeRenameAria.replace("{name}", code.name)} onClick={() => { setEditing({ id: code.id, name: code.name, description: code.description }); setEditError(null); }}>{t.codeRename}</Button>{" "}
                  <Button tone="quiet" disabled={busy} aria-label={t.codeRemoveAria.replace("{name}", code.name)} onClick={() => void remove(code, false)}>{t.codeRemove}</Button>
                </>
              )}
            </li>
          ))}
        </ol>
      )}
      <form onSubmit={(event) => void add(event)} noValidate>
        {error?.field === "form" && <p role="alert">{t.errors[error.error]}</p>}
        <TextField label={t.codeName} value={draft.name} busy={busy} error={fieldError("name")} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
        <TextArea label={t.codeDescription} value={draft.description} busy={busy} error={fieldError("description")} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
        <p><Button type="submit" busy={busy}>{busy ? t.codeAdding : t.codeAdd}</Button></p>
      </form>
      <Dialog
        open={asking !== null} title={t.confirmCodeTitle} dismissible={!busy} onClose={() => setAsking(null)}
        actions={asking === null ? null : (
          <>
            <Button tone="quiet" disabled={busy} onClick={() => setAsking(null)}>{t.confirmNo}</Button>
            <Button busy={busy} onClick={() => void remove(asking, true)}>{busy ? t.removing : t.confirmCodeYes}</Button>
          </>
        )}
      >
        {asking !== null && <p>{t.confirmCodeBody.replace("{name}", asking.name)}</p>}
      </Dialog>
    </Card>
  );
}

/** The offset of a point of the selection inside its line: what comes before it in the line's text. */
function offsetIn(line: Element, node: Node, offset: number): number {
  const range = document.createRange();
  range.selectNodeContents(line);
  range.setEnd(node, offset);
  return range.toString().length;
}
function lineOf(node: Node | null, root: Element): Element | null {
  const el = node instanceof Element ? node : node?.parentElement ?? null;
  const line = el?.closest("[data-line]") ?? null;
  return line !== null && root.contains(line) ? line : null;
}

function Marking({ materialId, lines, codes, busy, setBusy, call, setNote, lost, reconcile }: Shared & { materialId: string; lines: readonly string[]; codes: readonly Code[] }) {
  const root = useRef<HTMLDivElement>(null);
  const [codeId, setCodeId] = useState("");
  const [memo, setMemo] = useState("");
  const [error, setError] = useState<MarkError | null>(null);

  /** The selection is read when the button is pressed, and only when it lies inside one line of the text. */
  function selected(): Selection | null {
    const sel = window.getSelection();
    if (root.current === null || sel === null || sel.rangeCount === 0 || sel.isCollapsed) return null;
    const range = sel.getRangeAt(0);
    const first = lineOf(range.startContainer, root.current);
    const last = lineOf(range.endContainer, root.current);
    if (first === null || first !== last) return null;
    const paragraph = Number(first.getAttribute("data-line"));
    return { paragraph, start: offsetIn(first, range.startContainer, range.startOffset), end: offsetIn(first, range.endContainer, range.endOffset) };
  }

  async function mark(selection: Selection | null) {
    if (busy) return;
    setNote(null);
    const checked = checkMark(lines, codeId, selection, memo);
    if (!checked.ok) { setError(checked.error); return; }
    setError(null);
    setBusy(true);
    const outcome = await addSegment(call(), materialId, { codeId, anchor: checked.anchor, ...(checked.memo === undefined ? {} : { memo: checked.memo }) });
    if (lost(outcome)) { setBusy(false); return; }
    if (outcome.kind === "saved") { setNote({ tone: "status", text: t.marked }); setMemo(""); window.getSelection()?.removeAllRanges(); }
    else setNote({ tone: "alert", text: outcome.kind === "invalid" ? t.markInvalid : outcome.kind === "unknown" ? t.markUnknown : t.markConflict });
    await reconcile();
    setBusy(false);
  }

  return (
    <Card level={2} title={t.textTitle}>
      <p>{t.textHint}</p>
      <Select label={t.pickCode} disabled={busy} value={codeId} error={error === "noCode" ? t.errors.noCode : undefined}
        options={[{ value: "", label: t.pickCodeEmpty }, ...codes.map((c) => ({ value: c.id, label: c.name }))]} onChange={(e) => setCodeId(e.target.value)} />
      <TextArea label={t.memo} busy={busy} value={memo} error={error === "memoTooLong" || error === "memoInvalid" ? t.errors[error] : undefined} onChange={(e) => setMemo(e.target.value)} />
      {error !== null && error !== "noCode" && error !== "memoTooLong" && error !== "memoInvalid" && <p role="alert">{t.errors[error]}</p>}
      <p><Button busy={busy} onClick={() => void mark(selected())}>{busy ? t.marking : t.markSelected}</Button></p>
      <div ref={root} data-testid="material-text">
        {lines.map((line, index) => (line.trim() === "" ? null : (
          <div key={index}>
            <small>{t.paragraph.replace("{n}", String(index + 1))}</small>{" "}
            <Button tone="quiet" disabled={busy} aria-label={t.markWholeAria.replace("{n}", String(index + 1))} onClick={() => void mark(wholeParagraph(lines, index))}>{t.markWhole}</Button>
            <p data-line={index} style={{ whiteSpace: "pre-wrap" }}>{line}</p>
          </div>
        )))}
      </div>
    </Card>
  );
}

function Segments({ codes, segments, busy, setBusy, call, setNote, lost, reconcile }: Shared & { codes: readonly Code[]; segments: SegmentsReadOk["segments"] }) {
  const name = (codeId: string) => codes.find((c) => c.id === codeId)?.name ?? t.codeGoneSegment;
  const ordered = orderSegments(segments, codes);

  async function remove(id: string) {
    if (busy) return;
    setNote(null);
    setBusy(true);
    const outcome = await removeSegment(call(), id);
    if (lost(outcome)) { setBusy(false); return; }
    setNote(outcome.kind === "removed" ? { tone: "status", text: t.segmentRemoved }
      : { tone: "alert", text: outcome.kind === "notFound" ? t.segmentGone : t.segmentRemoveUnknown });
    await reconcile();
    setBusy(false);
  }

  return (
    <Card level={2} title={t.segmentsTitle}>
      {ordered.length === 0 ? <><h3>{t.noSegments.title}</h3><p>{t.noSegments.body}</p></> : (
        <>
          <p>{countText(ordered.length, t.segmentCount)}. {t.segmentsOrder}</p>
          <ul>
            {ordered.map((s) => (
              <li key={s.id} data-testid="segment">
                <Tag tone="accent">{name(s.codeId)}</Tag>{" "}<span>{t.segmentPlace.replace("{n}", String(s.paragraph + 1))}</span>
                <blockquote>{s.quote}</blockquote>
                {s.memo !== null && <p>{s.memo}</p>}
                <Button tone="quiet" disabled={busy} aria-label={t.segmentRemoveAria.replace("{quote}", s.quote)} onClick={() => void remove(s.id)}>{t.segmentRemove}</Button>
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  );
}
type SegmentsReadOk = Extract<SegmentsRead, { kind: "ok" }>;
