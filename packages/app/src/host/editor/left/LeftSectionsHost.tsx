"use client";

// WEB-2126: the sections of the left panel (Zahtjevi, Prikazi i fusnote,
// Odloženo, Napredak, Rokovi, Nit rada). Only what the work itself holds is
// shown; the faculty's rules, the revision deadline and the sources count come
// from the server and say "nedostupno" until it gives them. ED-37 (P2-6): the
// submission deadline is the assignment's `dueAt`, which the page already reads;
// the mentorship's milestones and consultations come from mentor-dates.ts, and
// the rail footer sets the words against the assignment's range (ED-37, dio 3).
import { Button, TextField } from "@ductura/ui";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";

import { createApi } from "../../../../../../src/client/api.ts";
import { createTocStore, EMPTY_TOC, goToHeading } from "../../../../../editor-core/src/outline/index.ts";
import { requestPanel } from "../../../../../../src/components/editor/layout-prefs/open-panel.ts";
import { useLocalEditor } from "../../../../../../src/components/editor/LocalDocument.tsx";
import {
  allObservations, assistHr, BalancePanel, distribute, holesOf, EMPTY_NOTES, loadNotes, nextSteps, NextStepCard, notesKey, parseNotes, QuickJump, ResumeCard, loadSeen, saveSeen, whatsNew, WhatsNewCard, type Change, type Seen,
  StartWizard, ThreadPanel, withLast, withSelfNote, withTargets, workStatus, type JumpKind, type JumpPlace, type NextStepInput,
  type StepTarget, type WorkNotes, type WorkRange,
} from "../assist";
import { EMPTY_HELP, helpDocumentOf } from "./chapter-help";
import { ChapterLength } from "../chapter-length/ChapterLength";
import { useChapterTargets } from "../chapter-length/use-chapter-targets";
import {
  addDeadline, daysUntil, EMPTY_THREAD, goalStatus, MAX_HYPOTHESES, pagesOf, parseDeadlines, parseStash, parseThread, preview,
  progressRatio, stashAdd, stashRemove, zagrebDay, type OwnDeadline,
} from "./left-model";
import { readMentorDates, type MentorDates, type MentorDatesCall } from "./mentor-dates";
import { leftHr as t } from "./messages.hr";
import { announceDeviceChange, useDeviceChange, useDeviceValue, useEditorRead, useWorkSnapshot } from "./use-left";
import { HistorySection } from "./HistorySection";
import { momentHr } from "../../student/work/frame";
import styles from "./Left.module.css";

type Props = { workId: string };
/** The submission deadline of the assignment (an instant), or null when the page has none. */
type Due = { dueAt?: string | null };

/** Whole Zagreb days to the deadline ("za 3 dana" / "prošlo je 2 dana"), or null without a readable one. */
function dueDays(dueAt: string | null | undefined, now: Date): string | null {
  const day = dueAt ? zagrebDay(dueAt) : null;
  const days = day === null ? null : daysUntil(day, now);
  return days === null ? null : days < 0 ? t.deadlines.late(-days) : t.deadlines.in(days);
}

/** "15. 12. 2099., 23:59 · za 3 dana", or null when there is no readable deadline. */
function dueLine(dueAt: string | null | undefined, now: Date): string | null {
  if (!dueAt) return null;
  const moment = momentHr(dueAt);
  if (moment === null || zagrebDay(dueAt) === null) return null;
  const days = dueDays(dueAt, now);
  return days === null ? moment : `${moment} · ${days}`;
}

/** The rail footer (prototype rail.js `foot`): words against the assignment's range, then the days to the deadline. */
function railFootLine(words: number, range: { min: number; max: number } | null, dueAt: string | null | undefined, now: Date): string {
  const days = dueDays(dueAt, now);
  const scope = t.progress.footer(words, range?.min ?? null, range?.max ?? null);
  return days === null ? scope : `${scope} · ${days}`;
}

/** ED-37 (dio 3): the footer under the left panel's sections, read from the text as it is. */
function RailFooter({ range, dueAt, now = new Date() }: Due & { range: { min: number; max: number } | null; now?: Date }) {
  const { total } = useWorkSnapshot();
  return <p className={styles.muted} data-rail-foot="">{railFootLine(total, range, dueAt, now)}</p>;
}
const newId = () => (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`);

function Requirements() {
  const snap = useWorkSnapshot();
  const targets = useChapterTargets(true);
  const rows = snap.headings.flatMap((h, i) => {
    const goal = h.id ? targets.get(h.id) : undefined;
    return goal ? [{ h, goal, words: snap.words[i] ?? 0 }] : [];
  });
  return (
    <div className={styles.stack}>
      <h3>{t.requirements.heading}</h3>
      {rows.length === 0 ? <p className={styles.muted}>{t.requirements.none}</p> : (
        <ul className={styles.list}>
          {rows.map(({ h, goal, words }) => {
            const status = goalStatus(words, goal);
            return (
              <li key={h.id ?? h.pos} className={styles.item}>
                <span>{h.number}. {h.title}<br /><ChapterLength words={words} target={goal} /></span>
                <span className={styles.chip}>{status === "met" ? t.requirements.met : status === "below" ? t.requirements.below(goal.min ?? 0) : t.requirements.above(goal.max ?? 0)}</span>
              </li>
            );
          })}
        </ul>
      )}
      <p className={styles.muted}>{t.requirements.rulesUnavailable}</p>
    </div>
  );
}

function Figures() {
  const editor = useLocalEditor();
  const { figures } = useWorkSnapshot();
  if (figures.length === 0) return <p className={styles.muted}>{t.figures.none}</p>;
  const go = (pos: number) => {
    if (!editor || editor.isDestroyed) return;
    editor.chain().setTextSelection(Math.min(pos + 1, editor.state.doc.content.size)).scrollIntoView().focus().run();
  };
  return (
    <ol className={styles.list}>
      {figures.map((f, i) => (
        <li key={`${f.kind}-${f.pos}`} className={styles.item}>
          <span>{t.figures[f.kind]} {i + 1}{f.text ? ` · ${preview(f.text, 40)}` : ""}</span>
          <Button tone="quiet" onClick={() => go(f.pos)}>{t.figures.go}</Button>
        </li>
      ))}
    </ol>
  );
}

function Stash({ workId }: Props) {
  const editor = useLocalEditor();
  const snap = useWorkSnapshot();
  const [items, setItems] = useDeviceValue("stash", workId, parseStash, []);
  const [message, setMessage] = useState("");
  const live = Boolean(editor && !editor.isDestroyed && editor.isEditable);
  const stashSelection = () => {
    if (!editor || !live || snap.selected.trim() === "") return setMessage(t.stash.selectFirst);
    setItems(stashAdd(items, snap.selected, newId(), new Date().toISOString()));
    editor.chain().deleteSelection().focus().run();
    setMessage(t.stash.stashed);
  };
  const restore = (text: string, id: string) => {
    if (!editor || !live) return;
    editor.chain().insertContent(text).focus().run();
    setItems(stashRemove(items, id));
    setMessage(t.stash.restored);
  };
  return (
    <div className={styles.stack}>
      <Button tone="quiet" disabled={!live} onClick={stashSelection}>{t.stash.stashSelection}</Button>
      {items.length === 0 ? <p className={styles.muted}>{t.stash.empty}</p> : (
        <ul className={styles.list}>
          {items.map((item) => (
            <li key={item.id} className={styles.item}>
              <span>{preview(item.text)}</span>
              <span>
                <Button tone="quiet" disabled={!live} onClick={() => restore(item.text, item.id)}>{t.stash.restore}</Button>
                <Button tone="quiet" onClick={() => setItems(stashRemove(items, item.id))}>{t.stash.remove}</Button>
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className={styles.muted}>{t.stash.hint}</p>
      <p role="status" className={styles.live}>{message}</p>
    </div>
  );
}

function Progress({ dueAt, now = new Date() }: Due & { now?: Date }) {
  const due = dueLine(dueAt, now);
  const snap = useWorkSnapshot();
  const targets = useChapterTargets(true);
  const start = useRef<number | null>(null);
  if (start.current === null && snap.headings.length > 0) start.current = snap.total;
  const goals = snap.headings.flatMap((h, i) => (h.id && targets.get(h.id) ? [{ h, goal: targets.get(h.id)!, words: snap.words[i] ?? 0 }] : []));
  const met = goals.filter((g) => goalStatus(g.words, g.goal) === "met").length;
  const current = snap.headings[snap.current];
  const goal = current?.id ? targets.get(current.id) : undefined;
  return (
    <div className={styles.stack}>
      <p>{t.progress.words(snap.total)} · {t.progress.pages(pagesOf(snap.total))}</p>
      <p className={styles.muted}>{t.progress.session(snap.total - (start.current ?? snap.total))}</p>
      <p className={styles.muted}>{t.progress.sources}: {t.progress.sourcesUnavailable}</p>
      <p className={styles.muted} data-due={due === null ? undefined : ""}>{t.progress.deadline}: {due ?? t.progress.deadlineUnavailable}</p>
      {goals.length > 0 && <p>{t.progress.goals(met, goals.length)}</p>}
      {current && <p className={styles.muted}>{t.progress.footer(snap.words[snap.current] ?? 0, goal?.min ?? null, goal?.max ?? null)}</p>}
      <h3>{t.progress.byChapter}</h3>
      <ul className={styles.list}>
        {snap.headings.map((h, i) => {
          const g = h.id ? targets.get(h.id) : undefined;
          const ratio = progressRatio(snap.words[i] ?? 0, g);
          return (
            <li key={h.id ?? h.pos}>
              <span>{h.number}. {h.title} · {snap.words[i] ?? 0}</span>
              {ratio !== null && <div className={styles.bar} role="progressbar" aria-label={`${h.number}. ${h.title}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(ratio * 100)}><span style={{ inlineSize: `${ratio * 100}%` }} /></div>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** ED-37 (dio 2): the mentorship's milestones and consultations ahead, as read; nothing is made up. */
function MentorDatesView({ dates }: { dates: MentorDates }) {
  const line = (text: string) => <p>{t.deadlines.mentorship}: <span className={styles.muted}>{text}</span></p>;
  if (dates.kind === "loading") return line(t.deadlines.mentorshipLoading);
  if (dates.kind === "none") return line(t.deadlines.mentorshipNone);
  if (dates.kind === "signedOut") return line(t.deadlines.mentorshipSignedOut);
  if (dates.kind === "unavailable") return line(t.deadlines.mentorshipUnavailable);
  return (
    <div data-mentor-dates="">
      <p>{t.deadlines.mentorship}:{dates.ahead.length === 0 && <> <span className={styles.muted}>{t.deadlines.mentorshipEmpty}</span></>}</p>
      {dates.ahead.length > 0 && (
        <ul className={styles.list}>
          {dates.ahead.map((r) => <li key={`${r.kind}:${r.id}`}>{r.label} · {r.when} · {r.relative}</li>)}
        </ul>
      )}
      {dates.past > 0 && <p className={styles.muted}>{t.deadlines.mentorshipPast(dates.past)}</p>}
    </div>
  );
}

const realMentorDates = (workId: string) => readMentorDates(createApi() as unknown as MentorDatesCall, workId);

function MentorDatesBlock({ workId, read = realMentorDates }: Props & { read?: (workId: string) => Promise<MentorDates> }) {
  const [dates, setDates] = useState<MentorDates>({ kind: "loading" });
  useEffect(() => {
    let live = true;
    setDates({ kind: "loading" });
    void read(workId).then((d) => { if (live) setDates(d); }, () => { if (live) setDates({ kind: "unavailable" }); });
    return () => { live = false; };
  }, [workId, read]);
  return <MentorDatesView dates={dates} />;
}

function Deadlines({ workId, dueAt, now = new Date() }: Props & Due & { now?: Date }) {
  const due = dueLine(dueAt, now);
  const [items, setItems] = useDeviceValue<OwnDeadline[]>("deadlines", workId, parseDeadlines, []);
  const [label, setLabel] = useState("");
  const [date, setDate] = useState("");
  const [error, setError] = useState("");
  const add = () => {
    const next = addDeadline(items, label, date, newId());
    if (!next) return setError(t.deadlines.invalid);
    setItems(next);
    setLabel(""); setDate(""); setError("");
  };
  const when = (iso: string) => {
    const days = daysUntil(iso, now);
    return days === null ? "" : days < 0 ? t.deadlines.late(-days) : t.deadlines.in(days);
  };
  return (
    <div className={styles.stack}>
      <p data-due={due === null ? undefined : ""}>{t.deadlines.submission}: {due ?? <span className={styles.muted}>{t.deadlines.submissionUnavailable}</span>}</p>
      <p>{t.deadlines.revision}: <span className={styles.muted}>{t.deadlines.revisionUnavailable}</span></p>
      <p>{t.deadlines.faculty}: <span className={styles.muted}>{t.deadlines.facultyUnavailable}</span></p>
      <MentorDatesBlock workId={workId} />
      <h3>{t.deadlines.own}</h3>
      {items.length === 0 ? <p className={styles.muted}>{t.deadlines.ownEmpty}</p> : (
        <ul className={styles.list}>
          {items.map((d) => (
            <li key={d.id} className={styles.item}>
              <span>{d.label} · {d.date} · {when(d.date)}</span>
              <Button tone="quiet" aria-label={`${t.deadlines.remove}: ${d.label}`} onClick={() => setItems(items.filter((x) => x.id !== d.id))}>×</Button>
            </li>
          ))}
        </ul>
      )}
      <TextField label={t.deadlines.label} value={label} maxLength={80} onChange={(e) => setLabel(e.currentTarget.value)} />
      <TextField label={t.deadlines.date} type="date" value={date} onChange={(e) => setDate(e.currentTarget.value)} error={error || undefined} />
      <Button tone="quiet" onClick={add}>{t.deadlines.add}</Button>
    </div>
  );
}

function Thread({ workId }: Props) {
  const [thread, setThread] = useDeviceValue("thread", workId, parseThread, EMPTY_THREAD);
  const [draft, setDraft] = useState("");
  return (
    <div className={styles.stack}>
      <p><strong>{t.thread.question}:</strong> {thread.question || <span className={styles.muted}>{t.thesis.empty}</span>}</p>
      <h3>{t.thread.hypotheses}</h3>
      {thread.hypotheses.length === 0 ? <p className={styles.muted}>{t.thread.noHypotheses}</p> : (
        <ol className={styles.list}>
          {thread.hypotheses.map((h, i) => (
            <li key={`${i}-${h}`} className={styles.item}>
              <span><strong>{t.thread.hypothesisOf(i + 1)}</strong> {h}</span>
              <Button tone="quiet" aria-label={`${t.thread.removeHypothesis} ${t.thread.hypothesisOf(i + 1)}`}
                onClick={() => setThread({ ...thread, hypotheses: thread.hypotheses.filter((_, j) => j !== i) })}>×</Button>
            </li>
          ))}
        </ol>
      )}
      <TextField label={t.thread.hypothesisText} value={draft} maxLength={500} onChange={(e) => setDraft(e.currentTarget.value)} />
      <Button tone="quiet" disabled={draft.trim() === "" || thread.hypotheses.length >= MAX_HYPOTHESES}
        onClick={() => { setThread({ ...thread, hypotheses: [...thread.hypotheses, draft.trim()] }); setDraft(""); }}>{t.thread.addHypothesis}</Button>
      <h3>{t.thread.wholeWork}</h3>
      <p className={styles.muted}>{t.thread.wholeWorkHint}</p>
    </div>
  );
}

function noteStorage(): Storage | null {
  try { return typeof window === "undefined" ? null : window.localStorage; } catch { return null; }
}

/** The cards' own fields (stopping place, message to self, chapter goals) live under their own key: ChapterPanel saves its whole,
 * possibly stale, notes object under `notesKey` and would otherwise wipe them. Roles, plans and tasks are read from `notesKey`. */
const ownKey = (workId: string) => `${notesKey(workId)}.cards`;
const ownOf = (n: WorkNotes) => ({ ...EMPTY_NOTES, lastChapterId: n.lastChapterId, selfNote: n.selfNote, targets: n.targets });
const readNotes = (workId: string): WorkNotes => {
  const own = loadNotesAt(workId);
  return { ...loadNotes(noteStorage(), workId), lastChapterId: own.lastChapterId, selfNote: own.selfNote, targets: own.targets };
};
function loadNotesAt(workId: string): WorkNotes {
  try { return parseNotes(noteStorage()?.getItem(ownKey(workId))); } catch { return EMPTY_NOTES; }
}

/** The student's own writing-help notes of the work (device only), read again when ChapterPanel or another tab writes them. */
function useWritingNotes(workId: string): [WorkNotes, (change: (current: WorkNotes) => WorkNotes) => void] {
  const [notes, setNotes] = useState<WorkNotes>(() => readNotes(workId));
  useDeviceChange(notesKey(workId), () => setNotes(readNotes(workId)));
  useDeviceChange(ownKey(workId), () => setNotes(readNotes(workId)));
  const change = (apply: (current: WorkNotes) => WorkNotes) => {
    const next = apply(readNotes(workId));
    setNotes(next);
    try {
      noteStorage()?.setItem(ownKey(workId), JSON.stringify(ownOf(next)));
      announceDeviceChange(ownKey(workId));
    } catch { /* a full or blocked store keeps the value for this visit */ }
  };
  return [notes, change];
}

/** ED-36 / EDI-R16: the chapters of the open document as the writing help reads them, the chapter under the cursor, and whether the text can be changed. */
function useHelpState() {
  const editor = useLocalEditor();
  const store = useMemo(() => createTocStore(editor), [editor]);
  const toc = useSyncExternalStore(store.subscribe, store.getSnapshot, () => EMPTY_TOC);
  const help = useEditorRead(editor, (i) => helpDocumentOf(i.getJSON()), EMPTY_HELP);
  const live = useEditorRead(editor, (i) => i.isEditable, false);
  const current = help.chapters.some((c) => c.id === toc.currentKey) ? toc.currentKey : null;
  return { editor, help, live, current };
}

const wizardEvent = "ductura:open-start-wizard";

/** "Započnite rad": the three-step wizard puts a skeleton into an empty work; the question stays on this device with the thread. */
function StartWork({ workId }: Props) {
  const { editor, help, live } = useHelpState();
  // EDI-R16: the wizard is mounted outside the collapsible sections of the left panel (see `StartWorkHost`), so its dialog is
  // always on a visible page; the cards inside the sections only ask for it with `wizardEvent`.
  const [open, setOpen] = useState(false);
  const onClose = () => setOpen(false);
  useEffect(() => {
    const ask = () => setOpen(true);
    window.addEventListener(wizardEvent, ask);
    return () => window.removeEventListener(wizardEvent, ask);
  }, []);
  const [thread, setThread] = useDeviceValue("thread", workId, parseThread, EMPTY_THREAD);
  return (
    <StartWizard open={open} chapterCount={help.chapters.length} profileLabel={null} onClose={onClose}
      onCreate={(skeleton) => {
        if (!editor || editor.isDestroyed || !live) return false;
        // A work that already has a title keeps it; an empty one takes the typed title; only a work without one gets a new heading.
        let titleAt: number | null = null;
        let titleEmpty = false;
        editor.state.doc.forEach((node, offset) => {
          if (titleAt === null && node.type.name === "heading" && Number(node.attrs.level) === 1) { titleAt = offset; titleEmpty = node.textContent.trim() === ""; }
        });
        const chapterNodes = skeleton.chapters.flatMap((title) => [{ type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: title }] }, { type: "paragraph" }]);
        const titleNode = skeleton.title === "" || titleAt !== null ? [] : [{ type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: skeleton.title }] }];
        // The chapters go to the end first, so the position of the title above them does not move.
        const chain = editor.chain().insertContentAt(editor.state.doc.content.size, [...titleNode, ...chapterNodes]);
        if (titleAt !== null && titleEmpty && skeleton.title !== "") chain.insertContentAt(titleAt + 1, skeleton.title);
        if (!chain.run()) return false;
        if (skeleton.question !== "") setThread({ ...thread, question: skeleton.question });
        return true;
      }} />
  );
}

/** MEN-24: per work, for this page visit: the chapters as last left and what differed on first load. */
const sinceSession = new Map<string, { leftAs: Seen | null; since: Change[] | null }>();

/** EDI-R16: "Sljedeći korak", "Nastavi gdje ste stali", "Brzi skok" and "Ravnoteža poglavlja" over the work as it is now. */
function WritingHelp({ workId, range = null }: Props & { range?: WorkRange | null }) {
  const { editor, help, live, current } = useHelpState();
  const snap = useWorkSnapshot();
  const [notes, change] = useWritingNotes(workId);
  // Where the person stopped last time, kept for this visit; moving on only updates the place saved for the next one.
  const [resumeAt] = useState(() => readNotes(workId).lastChapterId);
  const [thread] = useDeviceValue("thread", workId, parseThread, EMPTY_THREAD);
  const { chapters } = help;
  // MEN-24: the words of each chapter as they were left last time. The panel is unmounted when it is closed, so the starting point and
  // the comparison live per work for the whole page visit (sinceSession), not in this component: closing and reopening the panel
  // keeps what was shown, and the comparison is fixed on the first load of the chapters so this visit's own typing is not "new".
  const [session] = useState(() => {
    let kept = sinceSession.get(workId);
    if (!kept) { kept = { leftAs: loadSeen(noteStorage(), workId), since: null }; sinceSession.set(workId, kept); }
    return kept;
  });
  const [since, setSince] = useState<Change[] | null>(session.since);
  useEffect(() => {
    if (since !== null || chapters.length === 0) return;
    const fixed = session.since ?? whatsNew(session.leftAs, chapters);
    session.since = fixed;
    setSince(fixed);
  }, [since, chapters, session]);
  useEffect(() => { if (live && chapters.length > 0) saveSeen(noteStorage(), workId, chapters); }, [live, chapters, workId]);
  const wholeRange: WorkRange = range ?? { min: null, max: null };
  // The chapter the person stopped at is kept as they move on, so "Nastavi gdje ste stali" has somewhere to go back to.
  useEffect(() => { if (current !== null && current !== notes.lastChapterId) change((n) => withLast(n, current)); },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [current]);
  const input = { chapters, thesis: thread.question, roles: notes.roles };
  const todos = chapters.flatMap((c) => (notes.todos[c.id] ?? []).filter((x) => !x.done).slice(0, 1).map((x) => ({ chapterId: c.id, text: x.text })));
  const stepInput: NextStepInput = { ...input, submitted: false, teacherView: false, range: wholeRange, todos };
  const go = (id: string) => { if (editor && !editor.isDestroyed) goToHeading(editor, id); };
  const onGo = (target: StepTarget) => {
    if (target.kind === "chapter") go(target.id);
    else if (target.kind === "wizard") window.dispatchEvent(new Event(wizardEvent));
    else if (target.tab === "work" || target.tab === "comments" || target.tab === "sources") requestPanel(target.tab);
  };
  const places: Partial<Record<JumpKind, JumpPlace[]>> = {
    hole: chapters.flatMap((c) => (holesOf([c]).count > 0 ? [{ chapterId: c.id }] : [])),
    obs: allObservations(input).map((o) => ({ chapterId: o.chapterId })),
  };
  const resume = chapters.find((c) => c.id === resumeAt) ?? null;
  const hasRange = wholeRange.min !== null && wholeRange.max !== null;
  return (
    <div className={styles.stack} data-writing-help="">
      <NextStepCard steps={nextSteps(stepInput)} onGo={onGo} />
      <WhatsNewCard changes={since ?? []} onGo={go} />
      <ResumeCard chapter={resume} selfNote={notes.selfNote} editable={live} onGo={go} onSaveNote={(text) => change((n) => withSelfNote(n, text))} />
      <QuickJump chapters={chapters} places={places} onJump={go} />
      <BalancePanel chapters={chapters} targets={notes.targets} status={workStatus(snap.total, wholeRange)} onJump={go}
        canDistribute={live && hasRange}
        onDistribute={() => {
          const targets = distribute(chapters, notes.roles, wholeRange);
          if (!targets) return null;
          change((n) => withTargets(n, targets));
          return Object.keys(targets).length;
        }} />
    </div>
  );
}

/** EDI-R16: "Nit rada" of the writing help (question, hypotheses table, notes on the whole) and the entry to "Započnite rad". */
function ThreadHelp({ workId }: Props) {
  const { editor, help, live } = useHelpState();
  const [thread] = useDeviceValue("thread", workId, parseThread, EMPTY_THREAD);
  const [notes] = useWritingNotes(workId);
  return (
    <div className={styles.stack}>
      <ThreadPanel input={{ chapters: help.chapters, thesis: thread.question, roles: notes.roles }} editable={false} onThesis={() => undefined}
        onJump={(id) => { if (editor && !editor.isDestroyed) goToHeading(editor, id); }} />
      {help.chapters.length === 0 && <Button tone="quiet" disabled={!live} onClick={() => window.dispatchEvent(new Event(wizardEvent))}>{assistHr.wizard.title}</Button>}
    </div>
  );
}

type SectionKey = "requirements" | "figures" | "stash" | "progress" | "deadlines" | "thread" | "history";

/** The sections, keyed as the left panel expects them; "Povijest dokumenta" once the work's document is known. */
export function leftSectionsFor(workId: string, documentId?: string, dueAt?: string | null, range?: WorkRange | null): Partial<Record<SectionKey, ReactNode>> {
  return {
    requirements: <Requirements />, figures: <Figures />, stash: <Stash workId={workId} />,
    progress: <><WritingHelp workId={workId} range={range} /><Progress dueAt={dueAt} /></>, deadlines: <Deadlines workId={workId} dueAt={dueAt} />,
    thread: <><Thread workId={workId} /><ThreadHelp workId={workId} /></>,
    ...(documentId ? { history: <HistorySection documentId={documentId} /> } : {}),
  };
}

/** The "Započnite rad" wizard, mounted once beside the editor (not in a section of the left panel), so it opens visible and focused. */
export function StartWorkHost({ workId }: Props) {
  return <StartWork workId={workId} />;
}

export { Deadlines, dueLine, Figures, MentorDatesView, Progress, RailFooter, railFootLine, Requirements, Stash, Thread, ThreadHelp, WritingHelp };
