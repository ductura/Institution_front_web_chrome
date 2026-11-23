"use client";

import { Button, Select, TextArea, TextField } from "@ductura/ui";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";

import {
  addConsultationNote, readConsultations, readConsultationVersions, saveConsultation,
  type ConsultationRecord, type VersionsPage,
} from "../../../../../../src/client/consultation-records";
import { TeacherToastRegion, useTeacherToasts } from "../toast";
import { n12Messages as t } from "./messages.hr";
import { checkAddition, checkForm, dayHr, momentHr, recordTitle, revisionLabel, sortRecords, todayIso, versionOptions } from "./model";
import styles from "./n12.module.css";

/** The prototype writes dates as "3. 11. 2026." (day. month. year.). */
const dateHr = (heldOn: string) => {
  const [year, month, day] = heldOn.split("-").map(Number);
  return `${day}. ${month}. ${year}.`;
};

/**
 * N-12 "Konzultacije" (WEB-2161): list, new record and one record with additions, all inside the work.
 * Records are never deleted or edited; only the mentor adds, the student sees the same (D-47).
 * Success is shown only after the server confirms (B-6).
 */
export function N12Consultations({ documentId, workHref, appPath }: {
  documentId: string; workHref: string; appPath: string;
}) {
  const router = useRouter();
  const search = useSearchParams();
  const toasts = useTeacherToasts();
  const recordId = search.get("zapis");
  const recordHref = (id: string) => `${appPath}?zapis=${encodeURIComponent(id)}`;
  const [records, setRecords] = useState<ConsultationRecord[] | null | undefined>();
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    void readConsultations(documentId).then((list) => { if (live) setRecords(list); });
    return () => { live = false; };
  }, [documentId, attempt]);

  const record = records?.find(({ id }) => id === recordId);
  const toList = () => router.push(appPath);
  const toNew = () => router.push(`${appPath}?novi=1`);
  const frame = (title: string, body: ReactNode, busy = false) => (
    <div className={styles.wrap}>
      <header className={styles.bar}><a className="btn ghost" href={workHref}>{t.backToWork}</a></header>
      <div className={styles.page}>
        <section className={`panel ${styles.panel}`} aria-labelledby="pg-h" aria-busy={busy || undefined}>
          <div className={styles.top}><h1 id="pg-h">{title}</h1></div>
          <div className={styles.body}>{body}</div>
        </section>
      </div>
      <TeacherToastRegion toasts={toasts.toasts} onDismiss={toasts.dismiss} />
    </div>
  );

  if (records === undefined) {
    return frame(t.title, (
      <>
        <p className="note" role="status">{t.loading}</p>
        <div className="skel w80" /><div className="skel w60" /><div className="skel w40" />
      </>
    ), true);
  }
  if (records === null) {
    return frame(t.title, (
      <>
        <p className="note" role="alert">{t.readError}</p>
        <div className={styles.acts}><Button tone="secondary" onClick={() => { setRecords(undefined); setAttempt((n) => n + 1); }}>{t.retry}</Button></div>
      </>
    ));
  }
  if (search.has("novi")) {
    return frame(t.new, (
      <NewRecord documentId={documentId} toasts={toasts} onCancel={toList} onSaved={(saved) => {
        setRecords((current) => [...(current ?? []), saved]);
        toasts.show(t.recordSaved);
        router.replace(recordHref(saved.id));
      }} />
    ));
  }
  if (recordId !== null) {
    if (record === undefined) {
      return frame(t.title, (
        <>
          <p className="note" role="alert">{t.missingRecord}</p>
          <div className={styles.acts}><Button tone="secondary" onClick={toList}>{t.allRecords}</Button></div>
        </>
      ));
    }
    return frame(recordTitle(dateHr(record.heldOn)), (
      <RecordView key={record.id} documentId={documentId} record={record} toasts={toasts} onList={toList}
        onAdded={(addition) => setRecords((current) => current?.map((item) => item.id === record.id
          ? { ...item, additions: [...item.additions, addition] } : item))} />
    ));
  }
  if (records.length === 0) {
    return frame(t.title, (
      <>
        <p className="note">{t.empty}</p>
        <div className={styles.acts}><Button onClick={toNew}>{t.new}</Button></div>
      </>
    ));
  }
  return frame(t.title, (
    <>
      <div className="tbl" tabIndex={0} role="region" aria-label={t.list}>
        <table>
          <thead><tr><th scope="col">{t.date}</th><th scope="col">{t.topic}</th><th scope="col">{t.version}</th></tr></thead>
          <tbody>
            {sortRecords(records).map((item) => (
              <tr key={item.id}>
                <td><a href={`${workHref}/konzultacije?zapis=${encodeURIComponent(item.id)}`}
                  onClick={(event) => { event.preventDefault(); router.push(recordHref(item.id)); }}>{dateHr(item.heldOn)}</a></td>
                <td>{item.topic}</td>
                <td>{revisionLabel(item.revision)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="meta">{t.listNote}</p>
      <div className={styles.acts}><Button onClick={toNew}>{t.new}</Button></div>
    </>
  ));
}

type Toasts = ReturnType<typeof useTeacherToasts>;

function NewRecord({ documentId, toasts, onCancel, onSaved }: {
  documentId: string; toasts: Toasts; onCancel: () => void; onSaved: (record: ConsultationRecord) => void;
}) {
  const [versions, setVersions] = useState<VersionsPage["versions"]>([]);
  const [next, setNext] = useState<number | null>(null);
  const [request, setRequest] = useState<{ before: number | null }>({ before: null });
  const [loading, setLoading] = useState(true);
  const [versionError, setVersionError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const pending = useRef(false);
  const topic = useRef<HTMLInputElement>(null);
  const options = versionOptions(versions, dayHr);

  useEffect(() => {
    let live = true;
    void readConsultationVersions(documentId, request.before).then((page) => {
      if (!live) return;
      setLoading(false);
      setVersionError(page === null);
      if (page !== null) {
        setVersions((current) => [...current, ...page.versions]);
        setNext(page.nextBeforeRevision);
      }
    });
    return () => { live = false; };
  }, [documentId, request]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current) return;
    const data = new FormData(event.currentTarget);
    const field = (name: string) => String(data.get(name) ?? "");
    const checked = checkForm(
      { heldOn: field("heldOn"), revision: field("revision"), topic: field("topic"), agreement: field("agreement") },
      options.map(({ value }) => value),
    );
    if (!checked.ok) {
      if (field("topic").trim() === "") { setInvalid(true); topic.current?.focus(); }
      toasts.show(checked.message);
      return;
    }
    setInvalid(false);
    pending.current = true;
    setSaving(true);
    const saved = await saveConsultation(documentId, checked.value);
    if (saved !== null) return onSaved(saved);
    pending.current = false;
    setSaving(false);
    toasts.show(t.recordError);
  }

  return (
    <form className={styles.plain} onSubmit={submit} noValidate>
      <div className={styles.pair}>
        <TextField label={t.date} name="heldOn" type="date" defaultValue={todayIso()} />
        <Select key={options[0]?.value ?? "none"} label={t.version} name="revision" defaultValue={options[0]?.value}
          placeholder={options.length === 0 ? t.pickVersion : undefined} options={options} disabled={options.length === 0} />
      </div>
      {loading && <p className="note" role="status">{t.loadingVersions}</p>}
      {versionError && <p className="note" role="alert">{t.versionsError}</p>}
      {!loading && !versionError && next === null && options.length === 0 && <p className="note">{t.emptyVersions}</p>}
      {!loading && (versionError || next !== null) && (
        <div className={styles.acts}><Button tone="secondary" onClick={() => {
          setLoading(true);
          setVersionError(false);
          setRequest({ before: versionError ? request.before : next });
        }}>{versionError ? t.retry : t.olderVersions}</Button></div>
      )}
      <TextField label={t.topic} name="topic" ref={topic} invalid={invalid} />
      <TextArea label={t.agreement} name="agreement" />
      <p className="meta">{t.newNote}</p>
      <div className={styles.acts}>
        <Button type="submit" busy={saving} disabled={options.length === 0}>{saving ? t.saving : t.save}</Button>
        {!saving && <Button tone="secondary" onClick={onCancel}>{t.cancel}</Button>}
      </div>
    </form>
  );
}

function RecordView({ documentId, record, toasts, onList, onAdded }: {
  documentId: string; record: ConsultationRecord; toasts: Toasts; onList: () => void;
  onAdded: (addition: ConsultationRecord["additions"][number]) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const pending = useRef(false);
  const field = useRef<HTMLTextAreaElement>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current) return;
    const form = event.currentTarget;
    const checked = checkAddition(String(new FormData(form).get("text") ?? ""));
    if (!checked.ok) {
      setInvalid(true);
      field.current?.focus();
      toasts.show(checked.message);
      return;
    }
    setInvalid(false);
    pending.current = true;
    setSaving(true);
    const addition = await addConsultationNote(documentId, record.id, checked.text);
    pending.current = false;
    setSaving(false);
    if (addition === null) return void toasts.show(t.additionError);
    onAdded(addition);
    form.reset();
    toasts.show(t.additionSaved);
  }

  return (
    <>
      <div className={styles.kv}><span>{t.date}</span><b>{dateHr(record.heldOn)}</b></div>
      <div className={styles.kv}><span>{t.topic}</span><b>{record.topic}</b></div>
      <div className={styles.kv}><span>{t.version}</span><b>{revisionLabel(record.revision)}</b></div>
      <div className={styles.state}><span className={styles.heading}>{t.agreement}</span><span>{record.agreement || t.noAgreement}</span></div>
      <div className={styles.state}>
        <span className={styles.heading}>{t.additions}</span>
        {record.additions.length === 0 ? <span className="meta">{t.emptyAdditions}</span> : record.additions.map((addition) => (
          <div className={styles.entry} key={addition.id}>
            <span className={styles.who}>{t.additionAuthor} · {momentHr(addition.createdAt)}</span>
            <span>{addition.text}</span>
          </div>
        ))}
      </div>
      <form className={styles.plain} onSubmit={submit} noValidate>
        <TextArea label={t.additionText} name="text" ref={field} invalid={invalid} readOnly={saving} hint={t.additionNote} />
        <div className={styles.acts}><Button tone="secondary" type="submit" busy={saving}>{saving ? t.saving : t.add}</Button></div>
      </form>
      <p className="meta">{t.additionStudent}</p>
      <div className={styles.acts}><Button tone="secondary" onClick={onList}>{t.allRecords}</Button></div>
    </>
  );
}
