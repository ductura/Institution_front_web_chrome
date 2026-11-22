"use client";

// WEB-2122 (prototype mentor2, "Zapisnik"): consultation records both sides read. The teacher adds a
// record; everyone, the collaborator included, may add a note to one. Confirming a record by the other
// side has no server operation yet, so it is not offered (see PR "Pretpostavke").
import { Button } from "@ductura/ui";
import { useCallback, useEffect, useRef, useState } from "react";

import { addConsultationNote, readConsultations, saveConsultation, type ConsultationRecord } from "../../../../../../../src/client/consultation-records";

import styles from "./Consult.module.css";
import { canWriteRecords, dateText, type Role } from "./consult-model";
import { consultHr } from "./messages.hr";

const t = consultHr.records;
type Load = { kind: "loading" } | { kind: "ready"; records: readonly ConsultationRecord[] } | { kind: "unavailable" };

export function ConsultRecords({ documentId, role, revision }: { documentId: string; role: Role; revision: number }) {
  const [load, setLoad] = useState<Load>({ kind: "loading" });
  const [form, setForm] = useState<{ open: boolean; heldOn: string; topic: string; agreement: string; busy: boolean; error: string | null }>({ open: false, heldOn: "", topic: "", agreement: "", busy: false, error: null });
  const [notes, setNotes] = useState<Record<string, { draft: string; busy: boolean; error: string | null }>>({});
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  const read = useCallback(async () => {
    setLoad({ kind: "loading" });
    const records = await readConsultations(documentId);
    if (alive.current) setLoad(records === null ? { kind: "unavailable" } : { kind: "ready", records });
  }, [documentId]);
  useEffect(() => { void read(); }, [read]);

  const saveRecord = async () => {
    const heldOn = form.heldOn, topic = form.topic.trim(), agreement = form.agreement.trim();
    if (!heldOn || !topic || !agreement) { setForm((f) => ({ ...f, error: t.needAll })); return; }
    setForm((f) => ({ ...f, busy: true, error: null }));
    const saved = await saveConsultation(documentId, { heldOn, revision, topic, agreement });
    if (!alive.current) return;
    if (saved === null) { setForm((f) => ({ ...f, busy: false, error: t.failed })); return; }
    setLoad((l) => (l.kind === "ready" ? { kind: "ready", records: [saved, ...l.records] } : l));
    setForm({ open: false, heldOn: "", topic: "", agreement: "", busy: false, error: null });
  };

  const saveNote = async (record: ConsultationRecord) => {
    const draft = (notes[record.id]?.draft ?? "").trim();
    if (!draft) return;
    setNotes((all) => ({ ...all, [record.id]: { draft, busy: true, error: null } }));
    const saved = await addConsultationNote(documentId, record.id, draft);
    if (!alive.current) return;
    if (saved === null) { setNotes((all) => ({ ...all, [record.id]: { draft, busy: false, error: t.failed } })); return; }
    setLoad((l) => (l.kind === "ready" ? { kind: "ready", records: l.records.map((r) => (r.id === record.id ? { ...r, additions: [...r.additions, saved] } : r)) } : l));
    setNotes((all) => ({ ...all, [record.id]: { draft: "", busy: false, error: null } }));
  };

  if (load.kind === "loading") return <p role="status" className={styles.muted}>{t.loading}</p>;
  if (load.kind === "unavailable") {
    return <div className={styles.card}><p role="alert" className={styles.error}>{t.unavailable}</p><Button size="dense" tone="secondary" onClick={() => void read()}>{consultHr.slots.retry}</Button></div>;
  }
  const writer = canWriteRecords(role);
  return (
    <section className={styles.card} aria-labelledby="konzultacije-zapisnik">
      <h3 id="konzultacije-zapisnik">{t.title}</h3>
      {load.records.length === 0 ? <p className={styles.muted}>{writer ? t.emptyTeacher : t.empty}</p> : null}
      <ul className={styles.list}>
        {load.records.map((r) => {
          const note = notes[r.id] ?? { draft: "", busy: false, error: null };
          return (
            <li key={r.id} className={styles.item}>
              <b>{t.held.replace("{date}", dateText(r.heldOn))}</b>
              <p className={styles.noteText}>{t.topic.replace("{topic}", r.topic)}</p>
              <p className={styles.noteText}>{t.agreement.replace("{text}", r.agreement)}</p>
              {r.additions.length > 0 ? <ul className={styles.list} aria-label={t.additions}>{r.additions.map((a) => <li key={a.id} className={styles.noteText}>{a.text}</li>)}</ul> : null}
              <label>{t.noteLabel}
                <textarea className={styles.field} value={note.draft} disabled={note.busy} onChange={(e) => setNotes((all) => ({ ...all, [r.id]: { ...note, draft: e.target.value } }))} />
              </label>
              <Button size="dense" disabled={note.busy || note.draft.trim() === ""} onClick={() => void saveNote(r)}>{t.noteAdd}</Button>
              {note.error ? <p role="alert" className={styles.error}>{note.error}</p> : null}
            </li>
          );
        })}
      </ul>
      {writer ? (
        form.open ? (
          <div className={styles.card}>
            <label>{t.heldLabel}<input className={styles.field} type="date" value={form.heldOn} disabled={form.busy} onChange={(e) => setForm((f) => ({ ...f, heldOn: e.target.value }))} /></label>
            <label>{t.topicLabel}<input className={styles.field} value={form.topic} disabled={form.busy} onChange={(e) => setForm((f) => ({ ...f, topic: e.target.value }))} /></label>
            <label>{t.agreementLabel}<textarea className={styles.field} value={form.agreement} disabled={form.busy} onChange={(e) => setForm((f) => ({ ...f, agreement: e.target.value }))} /></label>
            <p className={styles.muted}>{t.agreementHint}</p>
            <div className={styles.row}>
              <Button size="dense" disabled={form.busy} onClick={() => void saveRecord()}>{form.busy ? consultHr.slots.sending : t.save}</Button>
              <Button size="dense" tone="secondary" disabled={form.busy} onClick={() => setForm((f) => ({ ...f, open: false, error: null }))}>{consultHr.slots.cancel}</Button>
            </div>
            {form.error ? <p role="alert" className={styles.error}>{form.error}</p> : null}
          </div>
        ) : <Button size="dense" tone="secondary" onClick={() => setForm((f) => ({ ...f, open: true }))}>{t.add}</Button>
      ) : null}
    </section>
  );
}
