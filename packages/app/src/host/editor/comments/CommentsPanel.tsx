"use client";

// WEB-2130 (prototype comments2): the Comments card. Kinds, whose move it is and filters, closing
// in two steps, quick replies, one comment on several places, a new comment on selected text and
// saved comments. A write shows success only from the server's answer (B-6); a failed write keeps
// what was typed. The collaborator only reads and comments (INVENTAR §7 t. 5).
import { Button, Chip, Dialog, PillTag } from "@ductura/ui";
import { useCallback, useEffect, useRef, useState } from "react";

import { useReportOpenComments } from "@/components/editor/layout-prefs/panel-counts";

import styles from "./comments.module.css";
import { MyChanges, type ReadMyChanges } from "./my-changes";
import { commentsHr as t } from "./messages.hr";
import {
  KINDS, abilities, applyFilters, bodyText, byRound, countsFor, isMine, messageFor, openForPrint, printText, quickReply,
  repeated, safely, showFilters, statusOf, turnLabel, turnOf, usableSelection, withComment,
  type Comment, type CommentsPort, type Kind, type Place, type Role, type Selection, type Template, type TurnFilter,
} from "./model";

type Load = { kind: "loading" } | { kind: "ready"; comments: readonly Comment[]; round: number; templates: readonly Template[] } | { kind: "unavailable" | "signedOut" };
type Dlg = "rounds" | "print" | "templates" | "new" | "changes" | null;

export function CommentsPanel({ workId, role, submitted = false, port, selection, docSize, activeId, seen = 0, onJump, onSessionEnd, onSeen, now = Date.now, changes }: {
  workId: string; role: Role; submitted?: boolean; port: CommentsPort | null;
  /** The last selection in the text, kept by the editor (buttons here must not lose it). */
  selection: () => Selection | null; docSize: () => number; activeId?: string | null; seen?: number;
  onJump: (place: Place) => void; onSessionEnd?: () => void; onSeen?: () => void; now?: () => number;
  /** ED-42: the student's own changes since the last review; absent, the menu has no such item. */
  changes?: ReadMyChanges;
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
  // ED-38 (P2-7): the count beside the card's tab, the same open comments the print lists.
  useReportOpenComments(load.kind === "ready" ? openForPrint(load.comments).length : 0);

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
    <Chip pressed={on} onClick={click}>{label}</Chip>
  );
  const open = openForPrint(comments);
  const groups = repeated(comments);
  const kindTone = (k: Kind) => (k === "must" ? "warn" : k === "praise" ? "ok" : "neutral") as "warn" | "ok" | "neutral";

  return (
    <section className={styles.root} aria-label={t.title}>
      <h3 className={styles.ptitle}>{t.title} ({live.length})</h3>
      {role === "collaborator" && <p className={styles.muted}>{t.readOnly}</p>}
      <p className={styles.muted}>{t.noteScope}</p>
      {message && <p role="status" className={styles.muted}>{message}</p>}
      {showFilters(live.length, turn, kindFilter, counts.fresh) && (
        <div className={styles.tools} role="group" aria-label={t.title}>
          {chip(t.filters.mine(counts.mine), turn === "mine", () => setTurn(turn === "mine" ? null : "mine"))}
          {chip(t.filters.waitingFor(mentorWord, counts.other), turn === "other", () => setTurn(turn === "other" ? null : "other"))}
          {counts.fresh > 0 && chip(t.filters.fresh(counts.fresh), turn === "new", () => setTurn(turn === "new" ? null : "new"))}
          {KINDS.map((k) => chip(t.kinds[k], kindFilter === k, () => setKindFilter(kindFilter === k ? null : k)))}
        </div>
      )}
      {groups.map((g) => (
        <div key={g.key} className={`${styles.card} ${styles.note}`}>
          <b>{t.repeated(g.total)}: {g.text}</b>
          <p>({g.open})</p>
        </div>
      ))}
      <div className={styles.bar}>
        {!submitted && <Button tone="secondary" size="dense" onClick={() => openNew()}>{t.newTitle}</Button>}
        <details className={styles.more}>
          <summary>{t.more}</summary>
          <div className={styles.menu}>
            <button type="button" onClick={() => void read()}>{t.refresh}</button>
            <button type="button" onClick={() => setDlg("rounds")}>{t.rounds}</button>
            <button type="button" onClick={() => setDlg("print")}>{t.print}</button>
            {role === "student" && changes && <button type="button" onClick={() => setDlg("changes")}>{t.myChanges}</button>}
            {role === "teacher" && <button type="button" onClick={() => setDlg("templates")}>{t.templatesTitle}</button>}
          </div>
        </details>
      </div>
      {shown.length === 0 && <p className={styles.muted}>{t.empty}</p>}
      <ul className={styles.list}>
        {shown.map((c) => {
          const can = abilities(c, role, submitted);
          const tn = turnOf(c);
          const label = turnLabel(tn, role);
          return (
            <li key={c.id} className={`${styles.card} ${c.id === activeId ? styles.active : ""} ${c.kind === "praise" ? styles.praise : ""}`} data-cid={c.id}>
              <div className={styles.meta}>
                {c.kind && <PillTag tone={kindTone(c.kind)}>{t.kinds[c.kind]}</PillTag>}
                <PillTag tone={c.resolved ? "ok" : "neutral"}>{statusOf(c)}</PillTag>
                {label && <PillTag tone={isMine(tn, role) ? "me" : "neutral"}>{label}</PillTag>}
              </div>
              <p className={styles.quote}>„{c.place.quote}”</p>
              <p className={styles.body}>{c.text}</p>
              {c.replies.map((r) => <p key={r.id} className={styles.reply}>{r.text}</p>)}
              <div className={styles.actions}>
                {c.place.lost ? <span className={styles.muted}>{t.textGone}</span> : <Button tone="ghost" size="dense" onClick={() => onJump(c.place)}>{t.show}</Button>}
              </div>
              {c.also.length > 0 && (
                <div className={styles.also}>
                  <p className={styles.sub}>{t.alsoTitle(c.also.length)}</p>
                  {c.also.map((a, i) => a.lost ? <i key={i}>{t.alsoGone}</i> : <button key={i} type="button" className={`${styles.quote} ${styles.jump}`} onClick={() => onJump(a)}>„{a.quote}”</button>)}
                </div>
              )}
              {replyFor === c.id ? (
                <div>
                  <label className={styles.label}>{t.replyLabel}
                    <textarea className={styles.field} value={draft} onChange={(e) => setDraft(e.target.value)} autoFocus
                      onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) void sendReply(c); if (e.key === "Escape") setReplyFor(null); }} />
                  </label>
                  <div className={styles.actions}>
                    <Button size="dense" busy={busy} onClick={() => void sendReply(c)}>{busy ? t.sending : t.send}</Button>
                    <Button tone="secondary" size="dense" onClick={() => setReplyFor(null)}>{t.cancel}</Button>
                  </div>
                </div>
              ) : (
                <div className={styles.actions}>
                  {can.reply && <Button tone="ghost" size="dense" onClick={() => { setReplyFor(c.id); setDraft(""); }}>{t.reply}</Button>}
                  {can.quick && (["clarify", "disagree"] as const).map((q) => (
                    <Chip key={q} onClick={() => { setReplyFor(c.id); setDraft(quickReply(q)); }}>{t.quick[q]}</Chip>
                  ))}
                  {can.resolve && <Button tone="ghost" size="dense" busy={busy} onClick={() => void run(() => port!.setResolved(workId, c.id, true), t.saved, (x) => x.resolved)}>{t.resolve}</Button>}
                  {can.reopen && <Button tone="ghost" size="dense" busy={busy} onClick={() => void run(() => port!.setResolved(workId, c.id, false), t.saved, (x) => !x.resolved)}>{t.reopen}</Button>}
                  {can.confirm && <Button size="dense" busy={busy} onClick={() => void run(() => port!.confirm(workId, c.id), t.saved, (x) => x.confirmed === true)}>{t.confirm}</Button>}
                  {can.confirm && <Button tone="secondary" size="dense" onClick={() => { setBackFor(c.id); setNote(""); }}>{t.sendBack}</Button>}
                  {can.addPlace && <Button tone="ghost" size="dense" onClick={() => void addHere(c)}>{t.alsoAdd}</Button>}
                </div>
              )}
              {backFor === c.id && (
                <div>
                  <label className={styles.label}>{t.sendBackLabel}
                    <textarea className={styles.field} value={note} onChange={(e) => setNote(e.target.value)} autoFocus />
                  </label>
                  <div className={styles.actions}>
                    <Button size="dense" busy={busy} onClick={() => void sendBack(c)}>{t.sendBack}</Button>
                    <Button tone="secondary" size="dense" onClick={() => setBackFor(null)}>{t.cancel}</Button>
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
            <h4 className={styles.ptitle}>{t.round(row.round, row.current)}</h4>
            <ul className={styles.list}>{row.comments.map((c) => <li key={c.id} className={styles.printItem}>{c.kind ? `${t.kinds[c.kind]}: ` : ""}{c.text} ({statusOf(c)})</li>)}</ul>
          </div>
        ))}
        {byRound(comments, round).length === 0 && <p className={styles.muted}>{t.noRounds}</p>}
      </Dialog>

      <Dialog open={dlg === "print"} title={t.print} onClose={() => setDlg(null)}
        actions={<><Button onClick={() => void copyPrint()}>{t.printCopy}</Button><Button tone="quiet" onClick={() => window.print()}>{t.printDo}</Button></>}>
        <p className={styles.muted}>{open.length === 0 ? t.printEmpty : t.printCount(open.length)}</p>
        <div className={styles.print}>
          {open.map((c) => (
            <div key={c.id} className={styles.printItem}>
              <blockquote>„{c.place.quote}”</blockquote>
              <p>{c.text}</p>
            </div>
          ))}
        </div>
      </Dialog>

      {changes && (
        <Dialog open={dlg === "changes"} title={t.myChanges} onClose={() => setDlg(null)} actions={<Button tone="quiet" onClick={() => setDlg(null)}>{t.cancel}</Button>}>
          <p className={styles.muted}>{t.myChangesNote}</p>
          {dlg === "changes" && <MyChanges workId={workId} read={changes} />}
        </Dialog>
      )}

      <Dialog open={dlg === "templates"} title={t.templatesTitle} onClose={() => setDlg(null)} actions={<Button tone="quiet" onClick={() => setDlg(null)}>{t.cancel}</Button>}>
        <p className={styles.muted}>{t.templatesNote}</p>
        {templates.length === 0 && <p className={styles.muted}>{t.templatesEmpty}</p>}
        <ul className={styles.list}>
          {templates.map((x) => (
            <li key={x.id} className={styles.card}>
              <p className={styles.body}>{x.text} <PillTag tone={kindTone(x.kind)}>{t.kinds[x.kind]}</PillTag></p>
              <div className={styles.actions}>
                <Button tone="ghost" size="dense" onClick={() => { setDlg(null); openNew({ text: x.text, kind: x.kind }); }}>{t.templateUse}</Button>
                <Button tone="ghost" size="dense" busy={busy} onClick={() => void templateWrite(() => port!.deleteTemplate(x.id))}>{t.templateDelete}</Button>
              </div>
            </li>
          ))}
        </ul>
      </Dialog>

      <Dialog open={dlg === "new"} title={t.newTitle} onClose={() => setDlg(null)} error={message && message !== t.published ? message : undefined}
        actions={<><Button busy={busy} onClick={() => void publish()}>{t.publish}</Button><Button tone="quiet" onClick={() => setDlg(null)}>{t.cancel}</Button></>}>
        <p className={styles.muted}>{t.newQuote}</p>
        <p className={styles.quote}>„{form.place?.quote}”</p>
        {role === "teacher" && (
          <div className={styles.kind} role="group" aria-label={t.newKind}>
            {KINDS.map((k) => (
              <button key={k} type="button" aria-pressed={form.kind === k} onClick={() => setForm((f) => ({ ...f, kind: k }))}>{t.kinds[k]}</button>
            ))}
          </div>
        )}
        <label className={styles.label}>{t.newText}
          <textarea className={styles.field} value={form.text} onChange={(e) => setForm((f) => ({ ...f, text: e.target.value }))} />
        </label>
        {role === "teacher" && <label className={styles.label}><input type="checkbox" checked={form.save} onChange={(e) => setForm((f) => ({ ...f, save: e.target.checked }))} /> {t.saveAsTemplate}</label>}
      </Dialog>
    </section>
  );
}
