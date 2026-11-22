"use client";

// WEB-2130 (prototype comments2): the Comments card. Kinds, whose move it is and filters, closing
// in two steps, quick replies, one comment on several places, a new comment on selected text and
// saved comments. A write shows success only from the server's answer (B-6); a failed write keeps
// what was typed. The collaborator only reads and comments (INVENTAR §7 t. 5).
import { Button, Dialog } from "@ductura/ui";
import { useCallback, useEffect, useRef, useState } from "react";

import styles from "./comments.module.css";
import { commentsHr as t } from "./messages.hr";
import {
  KINDS, abilities, applyFilters, bodyText, byRound, countsFor, isMine, messageFor, openForPrint, printText, quickReply,
  repeated, safely, showFilters, statusOf, turnLabel, turnOf, usableSelection, withComment,
  type Comment, type CommentsPort, type Kind, type Place, type Role, type Selection, type Template, type TurnFilter,
} from "./model";

type Load = { kind: "loading" } | { kind: "ready"; comments: readonly Comment[]; round: number; templates: readonly Template[] } | { kind: "unavailable" | "signedOut" };
type Dlg = "rounds" | "print" | "templates" | "new" | null;

export function CommentsPanel({ workId, role, submitted = false, port, selection, docSize, activeId, seen = 0, onJump, onSessionEnd, onSeen, now = Date.now }: {
  workId: string; role: Role; submitted?: boolean; port: CommentsPort | null;
  /** The last selection in the text, kept by the editor (buttons here must not lose it). */
  selection: () => Selection | null; docSize: () => number; activeId?: string | null; seen?: number;
  onJump: (place: Place) => void; onSessionEnd?: () => void; onSeen?: () => void; now?: () => number;
}) {
  const [load, setLoad] = useState<Load>({ kind: "loading" });
  const [turn, setTurn] = useState<TurnFilter>(null);
  const [kindFilter, setKindFilter] = useState<Kind | null>(null);
  const [replyFor, setReplyFor] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [backFor, setBackFor] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [dlg, setDlg] = useState<Dlg>(null);
  const [form, setForm] = useState<{ text: string; kind: Kind; save: boolean; place: Place | null }>({ text: "", kind: "must", save: false, place: null });
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  const read = useCallback(async () => {
    setLoad({ kind: "loading" });
    if (!port) { setLoad({ kind: "unavailable" }); return; }
    let result;
    try { result = await port.read(workId); } catch { result = { kind: "unavailable" as const }; }
    if (!alive.current) return;
    setLoad(result);
    if (result.kind === "signedOut") onSessionEnd?.();
  }, [port, workId, onSessionEnd]);
  useEffect(() => { void read(); }, [read]);
  useEffect(() => () => { onSeen?.(); }, [onSeen]);

  if (load.kind === "loading") return <p role="status" className={styles.muted}>{t.loading}</p>;
  if (load.kind !== "ready") {
    return (
      <div className={styles.root}>
        <p role="alert" className={styles.error}>{load.kind === "signedOut" ? t.signedOut : t.unavailable}</p>
        {load.kind === "unavailable" && <Button tone="quiet" onClick={() => void read()}>{t.refresh}</Button>}
      </div>
    );
  }

  const { comments, templates, round } = load;
  const live = comments;
  const counts = countsFor(live, role, seen);
  const shown = applyFilters(live, role, seen, turn, kindFilter, activeId ?? replyFor);
  const mentorWord = role === "teacher" ? "studenta" : "mentora";

  const run = async (call: () => Promise<Awaited<ReturnType<typeof safely>>>, ok: string, matches: (c: Comment) => boolean = () => true) => {
    if (!port || busy) return null;
    setBusy(true);
    const answer = await safely(call, matches);
    if (!alive.current) return null;
    setBusy(false);
    if (answer.kind === "signedOut") onSessionEnd?.();
    setMessage(messageFor(answer.kind, ok));
    if (answer.kind === "ok") setLoad((l) => (l.kind === "ready" ? { ...l, comments: withComment(l.comments, answer) } : l));
    return answer;
  };

  const sendReply = async (c: Comment) => {
    const body = bodyText(draft);
    if (body === null) return;
    const answer = await run(() => port!.reply(workId, c.id, body), t.saved, (x) => x.replies.some((r) => r.text === body));
    if (answer?.kind === "ok") { setReplyFor(null); setDraft(""); }
  };
  const addHere = async (c: Comment) => {
    const place = usableSelection(selection(), now(), docSize());
    if (!place) { setMessage(t.needSelection); return; }
    await run(() => port!.addPlace(workId, c.id, place), t.alsoAdded, (x) => x.also.length > c.also.length);
  };
  const sendBack = async (c: Comment) => {
    const answer = await run(() => port!.sendBack(workId, c.id, note.trim()), t.saved, (x) => !x.resolved);
    if (answer?.kind === "ok") { setBackFor(null); setNote(""); }
  };
  const openNew = (preset?: { text: string; kind: Kind }) => {
    const place = usableSelection(selection(), now(), docSize());
    if (!place) { setMessage(t.needSelection); return; }
    setForm({ text: preset?.text ?? "", kind: preset?.kind ?? "must", save: false, place });
    setDlg("new");
  };
  const publish = async () => {
    const body = bodyText(form.text);
    if (body === null || !form.place) return;
    const answer = await run(() => port!.create(workId, { text: body, kind: role === "teacher" ? form.kind : null, place: form.place!, saveAsTemplate: form.save && role === "teacher" }), t.published, (x) => x.text === body);
    if (answer?.kind === "ok") { setDlg(null); void read(); }
  };
  const templateWrite = async (call: () => ReturnType<CommentsPort["saveTemplate"]>) => {
    if (!port || busy) return;
    setBusy(true);
    let answer;
    try { answer = await call(); } catch { answer = { kind: "unknown" as const }; }
    if (!alive.current) return;
    setBusy(false);
    setMessage(messageFor(answer.kind, t.saved));
    if (answer.kind === "ok") setLoad((l) => (l.kind === "ready" ? { ...l, templates: answer.templates } : l));
  };
  const copyPrint = async () => {
    try { await navigator.clipboard.writeText(printText(comments)); setMessage(t.copied); } catch { setMessage(t.copyFailed); }
  };
  const chip = (label: string, on: boolean, click: () => void) => (
    <button type="button" className={styles.tag} aria-pressed={on} onClick={click}>{label}</button>
  );
  const open = openForPrint(comments);
  const groups = repeated(comments);

  return (
    <section className={styles.root} aria-label={t.title}>
      <div className={styles.row}>
        <h3>{t.title} ({live.length})</h3>
        <Button tone="quiet" onClick={() => void read()}>{t.refresh}</Button>
        {!submitted && <Button tone="quiet" onClick={() => openNew()}>{t.newTitle}</Button>}
        <Button tone="quiet" onClick={() => setDlg("rounds")}>{t.rounds}</Button>
        <Button tone="quiet" onClick={() => setDlg("print")}>{t.print}</Button>
        {role === "teacher" && <Button tone="quiet" onClick={() => setDlg("templates")}>{t.templatesTitle}</Button>}
      </div>
      {role === "collaborator" && <p className={styles.muted}>{t.readOnly}</p>}
      <p className={styles.muted}>{t.noteScope}</p>
      {message && <p role="status" className={styles.muted}>{message}</p>}
      {showFilters(live.length, turn, kindFilter, counts.fresh) && (
        <div className={styles.row} role="group" aria-label={t.title}>
          {chip(t.filters.mine(counts.mine), turn === "mine", () => setTurn(turn === "mine" ? null : "mine"))}
          {chip(t.filters.waitingFor(mentorWord, counts.other), turn === "other", () => setTurn(turn === "other" ? null : "other"))}
          {counts.fresh > 0 && chip(t.filters.fresh(counts.fresh), turn === "new", () => setTurn(turn === "new" ? null : "new"))}
          {KINDS.map((k) => chip(t.kinds[k], kindFilter === k, () => setKindFilter(kindFilter === k ? null : k)))}
        </div>
      )}
      {groups.map((g) => <p key={g.key} className={styles.muted}>{t.repeated(g.total)}: {g.text} ({g.open})</p>)}
      {shown.length === 0 && <p className={styles.muted}>{t.empty}</p>}
      <ul className={styles.list}>
        {shown.map((c) => {
          const can = abilities(c, role, submitted);
          const tn = turnOf(c);
          const label = turnLabel(tn, role);
          return (
            <li key={c.id} className={`${styles.card} ${c.id === activeId ? styles.active : ""}`} data-cid={c.id}>
              <div className={styles.row}>
                {c.kind && <span className={styles.tag}>{t.kinds[c.kind]}</span>}
                <span className={styles.tag}>{statusOf(c)}</span>
                {label && <span className={`${styles.tag} ${isMine(tn, role) ? styles.mine : ""}`}>{label}</span>}
              </div>
              <p className={styles.quote}>„{c.place.quote}”</p>
              <p>{c.text}</p>
              {c.replies.map((r) => <p key={r.id} className={styles.reply}>{r.text}</p>)}
              <div className={styles.row}>
                {c.place.lost ? <span className={styles.muted}>{t.textGone}</span> : <Button tone="quiet" onClick={() => onJump(c.place)}>{t.show}</Button>}
              </div>
              {c.also.length > 0 && (
                <div>
                  <p className={styles.muted}>{t.alsoTitle(c.also.length)}</p>
                  {c.also.map((a, i) => a.lost ? <i key={i}>{t.alsoGone}</i> : <Button key={i} tone="quiet" onClick={() => onJump(a)}>„{a.quote}”</Button>)}
                </div>
              )}
              {replyFor === c.id ? (
                <div className={styles.root}>
                  <label>{t.replyLabel}
                    <textarea className={styles.field} value={draft} onChange={(e) => setDraft(e.target.value)} autoFocus
                      onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) void sendReply(c); if (e.key === "Escape") setReplyFor(null); }} />
                  </label>
                  <div className={styles.row}>
                    <Button busy={busy} onClick={() => void sendReply(c)}>{busy ? t.sending : t.send}</Button>
                    <Button tone="quiet" onClick={() => setReplyFor(null)}>{t.cancel}</Button>
                  </div>
                </div>
              ) : (
                <div className={styles.row}>
                  {can.reply && <Button tone="quiet" onClick={() => { setReplyFor(c.id); setDraft(""); }}>{t.reply}</Button>}
                  {can.quick && (["clarify", "disagree"] as const).map((q) => (
                    <button key={q} type="button" className={styles.tag} onClick={() => { setReplyFor(c.id); setDraft(quickReply(q)); }}>{t.quick[q]}</button>
                  ))}
                  {can.resolve && <Button tone="quiet" busy={busy} onClick={() => void run(() => port!.setResolved(workId, c.id, true), t.saved, (x) => x.resolved)}>{t.resolve}</Button>}
                  {can.reopen && <Button tone="quiet" busy={busy} onClick={() => void run(() => port!.setResolved(workId, c.id, false), t.saved, (x) => !x.resolved)}>{t.reopen}</Button>}
                  {can.confirm && <Button busy={busy} onClick={() => void run(() => port!.confirm(workId, c.id), t.saved, (x) => x.confirmed === true)}>{t.confirm}</Button>}
                  {can.confirm && <Button tone="quiet" onClick={() => { setBackFor(c.id); setNote(""); }}>{t.sendBack}</Button>}
                  {can.addPlace && <Button tone="quiet" onClick={() => void addHere(c)}>{t.alsoAdd}</Button>}
                </div>
              )}
              {backFor === c.id && (
                <div className={styles.root}>
                  <label>{t.sendBackLabel}
                    <textarea className={styles.field} value={note} onChange={(e) => setNote(e.target.value)} autoFocus />
                  </label>
                  <div className={styles.row}>
                    <Button busy={busy} onClick={() => void sendBack(c)}>{t.sendBack}</Button>
                    <Button tone="quiet" onClick={() => setBackFor(null)}>{t.cancel}</Button>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <Dialog open={dlg === "rounds"} title={t.rounds} onClose={() => setDlg(null)} actions={<Button tone="quiet" onClick={() => setDlg(null)}>{t.cancel}</Button>}>
        <p className={styles.muted}>{t.roundsNote}</p>
        {byRound(comments, round).map((row) => (
          <div key={row.round}>
            <h4>{t.round(row.round, row.current)}</h4>
            <ul className={styles.list}>{row.comments.map((c) => <li key={c.id}>{c.kind ? `${t.kinds[c.kind]}: ` : ""}{c.text} ({statusOf(c)})</li>)}</ul>
          </div>
        ))}
        {byRound(comments, round).length === 0 && <p className={styles.muted}>{t.noRounds}</p>}
      </Dialog>

      <Dialog open={dlg === "print"} title={t.print} onClose={() => setDlg(null)}
        actions={<><Button onClick={() => void copyPrint()}>{t.printCopy}</Button><Button tone="quiet" onClick={() => window.print()}>{t.printDo}</Button></>}>
        <p className={styles.muted}>{open.length === 0 ? t.printEmpty : t.printCount(open.length)}</p>
        <ol>{open.map((c) => <li key={c.id}>„{c.place.quote}”: {c.text}</li>)}</ol>
      </Dialog>

      <Dialog open={dlg === "templates"} title={t.templatesTitle} onClose={() => setDlg(null)} actions={<Button tone="quiet" onClick={() => setDlg(null)}>{t.cancel}</Button>}>
        <p className={styles.muted}>{t.templatesNote}</p>
        {templates.length === 0 && <p className={styles.muted}>{t.templatesEmpty}</p>}
        <ul className={styles.list}>
          {templates.map((x) => (
            <li key={x.id} className={styles.row}>
              <span>{x.text} <span className={styles.tag}>{t.kinds[x.kind]}</span></span>
              <Button tone="quiet" onClick={() => { setDlg(null); openNew({ text: x.text, kind: x.kind }); }}>{t.templateUse}</Button>
              <Button tone="quiet" busy={busy} onClick={() => void templateWrite(() => port!.deleteTemplate(x.id))}>{t.templateDelete}</Button>
            </li>
          ))}
        </ul>
      </Dialog>

      <Dialog open={dlg === "new"} title={t.newTitle} onClose={() => setDlg(null)} error={message && message !== t.published ? message : undefined}
        actions={<><Button busy={busy} onClick={() => void publish()}>{t.publish}</Button><Button tone="quiet" onClick={() => setDlg(null)}>{t.cancel}</Button></>}>
        <p className={styles.muted}>{t.newQuote}</p>
        <p className={styles.quote}>„{form.place?.quote}”</p>
        {role === "teacher" && (
          <div className={styles.row} role="group" aria-label={t.newKind}>
            {KINDS.map((k) => chip(t.kinds[k], form.kind === k, () => setForm((f) => ({ ...f, kind: k }))))}
          </div>
        )}
        <label>{t.newText}
          <textarea className={styles.field} value={form.text} onChange={(e) => setForm((f) => ({ ...f, text: e.target.value }))} />
        </label>
        {role === "teacher" && <label><input type="checkbox" checked={form.save} onChange={(e) => setForm((f) => ({ ...f, save: e.target.checked }))} /> {t.saveAsTemplate}</label>}
      </Dialog>
    </section>
  );
}
