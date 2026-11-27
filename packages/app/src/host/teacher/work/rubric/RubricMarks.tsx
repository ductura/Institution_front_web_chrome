"use client";

import { Button, OptionGroup, TextArea } from "@ductura/ui";
import { useCallback, useEffect, useRef, useState } from "react";

import { LoadAlert } from "../../../states/States";
import { rubricMarksHr as t } from "./messages.hr";
import { readRubricMarks, saveMark, type Call, type MarksRead } from "./port";
import { isChanged, joinRows, noteValue, NOTE_MAX, withMark, type Level, type Mark } from "./rubric-marks-model";

const NONE = "none";
type Form = { level: Level | null; note: string; busy: boolean; message: string | null };

/**
 * The teacher's level mark per criterion of the assignment's rubric, on one work (WEB-V17-RUBRIC-MARK).
 * Renders nothing when the assignment has no rubric. Never shows a number, a sum, a grade or an order.
 */
export function RubricMarks({ documentId, call, onSessionEnd }: { documentId: string; call: Call; onSessionEnd?: () => void }) {
  const [read, setRead] = useState<MarksRead | null>(null);
  const [marks, setMarks] = useState<readonly Mark[]>([]);
  const [forms, setForms] = useState<Record<string, Form>>({});
  const alive = useRef(true);
  const sending = useRef(new Set<string>());
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  const load = useCallback(async () => {
    setRead(null);
    const result = await readRubricMarks(call, documentId);
    if (!alive.current) return;
    if (result.kind === "ready") { setMarks(result.marks); setForms({}); }
    if (result.kind === "signedOut") onSessionEnd?.();
    setRead(result);
  }, [call, documentId, onSessionEnd]);
  useEffect(() => { void load(); }, [load]);

  if (read === null) return <p role="status">{t.loading}</p>;
  if (read.kind === "none") return null;
  if (read.kind === "signedOut") return <p role="status">{t.signedOut}</p>;
  if (read.kind === "notFound") return <LoadAlert body={t.notFound} />;
  if (read.kind === "unavailable") {
    return <section aria-label={t.heading}><LoadAlert body={t.unavailable} retry={{ label: t.retry, onRetry: () => void load() }} /></section>;
  }

  const form = (m: Mark): Form => (Object.hasOwn(forms, m.criterionId) ? forms[m.criterionId] : undefined) ?? { level: m.level, note: m.note ?? "", busy: false, message: null };
  const patch = (m: Mark, next: Partial<Form>) => setForms((all) => ({ ...all, [m.criterionId]: { ...form(m), ...next } }));

  const save = async (m: Mark) => {
    const f = form(m);
    const note = noteValue(f.note);
    if (!note.ok) { patch(m, { message: t.noteTooLong(NOTE_MAX) }); return; }
    if (sending.current.has(m.criterionId)) return;
    sending.current.add(m.criterionId);
    patch(m, { busy: true, message: null });
    const result = await saveMark(call, documentId, m.criterionId, f.level, note.note);
    sending.current.delete(m.criterionId);
    if (!alive.current) return;
    if (result.kind === "saved") {
      setMarks((all) => withMark(all, result.mark));
      setForms((all) => ({ ...all, [m.criterionId]: { level: result.mark.level, note: result.mark.note ?? "", busy: false, message: t.saved } }));
    } else {
      patch(m, { busy: false, message: result.kind === "gone" ? t.conflictGone : result.kind === "signedOut" ? t.signedOut : t.failed });
      if (result.kind === "signedOut") onSessionEnd?.();
    }
  };

  return (
    <section aria-label={t.heading}>
      <h2>{t.heading}</h2>
      <p>{t.note}</p>
      {read.rubricVersion !== read.currentVersion && <p role="status">{t.versionNote}</p>}
      <ul>
        {joinRows(read.rubric, marks).map(({ criterion, mark }) => {
          const f = form(mark);
          const title = criterion?.title ?? t.unknownCriterion;
          return (
            <li key={mark.criterionId}>
              <OptionGroup legend={title} name={`rubric-${mark.criterionId}`} disabled={f.busy}
                value={f.level === null ? NONE : String(f.level)}
                options={[
                  ...(criterion?.levels.map((level, i) => ({ value: String(i), label: level.descriptor !== "" ? `${level.label} — ${level.descriptor}` : level.label })) ?? []),
                  { value: NONE, label: t.noLevel },
                ]}
                onChange={(value) => patch(mark, { level: value === NONE ? null : (Number(value) as Level), message: null })} />
              <TextArea label={t.noteLabel(title)} rows={2} value={f.note} maxLength={NOTE_MAX}
                onChange={(event) => patch(mark, { note: event.target.value, message: null })} />
              <Button type="button" disabled={f.busy || !isChanged(mark, f.level, f.note)} onClick={() => void save(mark)}>{t.save}</Button>
              {f.message !== null && f.message !== t.saved
                ? <LoadAlert body={f.message} />
                : <p role="status" aria-live="polite">{f.message}</p>}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
