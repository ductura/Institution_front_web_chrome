"use client";

import { Button, DataTable, Select, Skeleton, TextArea, TextField } from "@ductura/ui";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";

import {
  addConsultationNote, readConsultations, readConsultationVersions, saveConsultation,
  type ConsultationRecord, type VersionsPage,
} from "../../../../../../src/client/consultation-records";
import { formatDateHr, formatDateTimeHr } from "../../../../../../src/lib/i18n/hr";
import { n12Messages as t } from "./messages.hr";
import { checkAddition, checkForm, recordTitle, revisionLabel, sortRecords, todayIso, versionOptions } from "./model";
import styles from "./n12.module.css";

const dateHr = (heldOn: string) => formatDateHr(`${heldOn}T12:00:00Z`);

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
  const recordId = search.get("zapis");
  const recordHref = (id: string) => `${appPath}?zapis=${encodeURIComponent(id)}`;
  const [records, setRecords] = useState<ConsultationRecord[] | null | undefined>();
  const [attempt, setAttempt] = useState(0);
  const [createdId, setCreatedId] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    void readConsultations(documentId).then((list) => { if (live) setRecords(list); });
    return () => { live = false; };
  }, [documentId, attempt]);

  const record = records?.find(({ id }) => id === recordId);
  return (
    <div className={`page ${styles.page}`}>
      <a href={workHref}>{t.backToWork}</a>
      <h1>{t.title}</h1>
      {records === undefined ? <Skeleton label={t.loading} /> : records === null ? (
        <>
          <p role="alert" className={styles.error}>{t.readError}</p>
          <div><Button onClick={() => { setRecords(undefined); setAttempt((n) => n + 1); }}>{t.retry}</Button></div>
        </>
      ) : search.has("novi") ? (
        <NewRecord documentId={documentId} cancelHref={`${workHref}/konzultacije`} onSaved={(saved) => {
          setRecords((current) => [...(current ?? []), saved]);
          setCreatedId(saved.id);
          router.replace(recordHref(saved.id));
        }} />
      ) : recordId !== null ? (
        <>
          <a href={`${workHref}/konzultacije`} onClick={(event) => { event.preventDefault(); setCreatedId(null); router.push(appPath); }}>{t.allRecords}</a>
          {record === undefined ? <p role="alert">{t.missingRecord}</p> : (
            <RecordView key={record.id} documentId={documentId} record={record} justCreated={createdId === record.id}
              onAdded={(addition) => setRecords((current) => current?.map((item) => item.id === record.id
                ? { ...item, additions: [...item.additions, addition] } : item))} />
          )}
        </>
      ) : (
        <>
          {records.length === 0 ? <p>{t.empty}</p> : (
            <DataTable caption={t.list} rowKey={(item) => item.id} rows={sortRecords(records)} empty={t.empty} columns={[
              { id: "date", header: t.date, cell: (item) => <time dateTime={item.heldOn}>{dateHr(item.heldOn)}</time> },
              { id: "topic", header: t.topic, rowHeader: true, cell: (item) => (
                <a href={`${workHref}/konzultacije?zapis=${encodeURIComponent(item.id)}`}
                  onClick={(event) => { event.preventDefault(); router.push(recordHref(item.id)); }}>{item.topic}</a>
              ) },
              { id: "revision", header: t.version, cell: (item) => revisionLabel(item.revision) },
            ]} />
          )}
          <p className={styles.hint}>{t.listNote}</p>
          <div><Button onClick={() => { setCreatedId(null); router.push(`${appPath}?novi=1`); }}>{t.new}</Button></div>
        </>
      )}
    </div>
  );
}

function NewRecord({ documentId, cancelHref, onSaved }: {
  documentId: string; cancelHref: string; onSaved: (record: ConsultationRecord) => void;
}) {
  const [versions, setVersions] = useState<VersionsPage["versions"]>([]);
  const [next, setNext] = useState<number | null>(null);
  const [request, setRequest] = useState<{ before: number | null }>({ before: null });
  const [loading, setLoading] = useState(true);
  const [versionError, setVersionError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pending = useRef(false);
  const options = versionOptions(versions, formatDateTimeHr);

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
    if (!checked.ok) return setError(checked.message);
    pending.current = true;
    setSaving(true);
    setError(null);
    const saved = await saveConsultation(documentId, checked.value);
    if (saved !== null) return onSaved(saved);
    pending.current = false;
    setSaving(false);
    setError(t.recordError);
  }

  return (
    <section className={styles.panel} aria-labelledby="n12-novi">
      <h2 id="n12-novi">{t.new}</h2>
      <form onSubmit={submit} noValidate>
        <fieldset className={styles.fields} disabled={saving} aria-label={t.new}>
          <div className={styles.pair}>
            <TextField label={t.date} name="heldOn" type="date" defaultValue={todayIso()} />
            <Select label={t.version} name="revision" placeholder={t.pickVersion} options={options} disabled={options.length === 0} />
          </div>
          {loading && <p role="status">{t.loadingVersions}</p>}
          {versionError && <p role="alert" className={styles.error}>{t.versionsError}</p>}
          {!loading && !versionError && next === null && options.length === 0 && <p>{t.emptyVersions}</p>}
          {!loading && (versionError || next !== null) && (
            <div><Button tone="quiet" onClick={() => {
              setLoading(true);
              setVersionError(false);
              setRequest({ before: versionError ? request.before : next });
            }}>{versionError ? t.retry : t.olderVersions}</Button></div>
          )}
          <TextField label={t.topic} name="topic" />
          <TextArea label={t.agreement} name="agreement" />
          <p className={styles.hint}>{t.newNote}</p>
          {error !== null && <p role="alert" className={styles.error}>{error}</p>}
          <div className={styles.actions}>
            <Button type="submit" disabled={options.length === 0}>{saving ? t.saving : t.save}</Button>
            {!saving && <a href={cancelHref}>{t.cancel}</a>}
          </div>
        </fieldset>
      </form>
    </section>
  );
}

function RecordView({ documentId, record, justCreated, onAdded }: {
  documentId: string; record: ConsultationRecord; justCreated: boolean;
  onAdded: (addition: ConsultationRecord["additions"][number]) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ kind: "status" | "alert"; text: string } | null>(
    justCreated ? { kind: "status", text: t.recordSaved } : null,
  );
  const pending = useRef(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current) return;
    const form = event.currentTarget;
    const checked = checkAddition(String(new FormData(form).get("text") ?? ""));
    if (!checked.ok) return setNotice({ kind: "alert", text: checked.message });
    pending.current = true;
    setSaving(true);
    setNotice(null);
    const addition = await addConsultationNote(documentId, record.id, checked.text);
    pending.current = false;
    setSaving(false);
    if (addition === null) return setNotice({ kind: "alert", text: t.additionError });
    onAdded(addition);
    form.reset();
    setNotice({ kind: "status", text: t.additionSaved });
  }

  return (
    <section className={styles.panel} aria-labelledby="n12-zapis">
      <h2 id="n12-zapis">{recordTitle(dateHr(record.heldOn))}</h2>
      <dl className={styles.facts}>
        <dt>{t.topic}</dt><dd>{record.topic}</dd>
        <dt>{t.version}</dt><dd>{revisionLabel(record.revision)}</dd>
        <dt>{t.agreement}</dt><dd>{record.agreement || t.noAgreement}</dd>
      </dl>
      <section aria-labelledby="n12-dopune">
        <h3 id="n12-dopune">{t.additions}</h3>
        {record.additions.length === 0 ? <p>{t.emptyAdditions}</p> : (
          <ul className={styles.additions}>
            {record.additions.map((addition) => (
              <li key={addition.id}>
                <time dateTime={addition.createdAt}>{t.additionAuthor} · {formatDateTimeHr(addition.createdAt)}</time>
                <p>{addition.text}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
      <form onSubmit={submit} noValidate>
        <fieldset className={styles.fields} disabled={saving} aria-label={t.additionText}>
          <TextArea label={t.additionText} name="text" rows={3} />
          <p className={styles.hint}>{t.additionNote}</p>
          <p className={styles.hint}>{t.additionStudent}</p>
          {notice !== null && <p role={notice.kind} className={notice.kind === "alert" ? styles.error : undefined}>{notice.text}</p>}
          <div><Button type="submit">{saving ? t.saving : t.add}</Button></div>
        </fieldset>
      </form>
    </section>
  );
}
