import { Button, Select, TextArea, TextField } from "@ductura/ui";
import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";

import {
  readConsultationVersions, saveConsultation, type ConsultationRecord, type VersionsPage,
} from "../../../client/consultation-records";
import { formatDateTimeHr } from "../../../lib/i18n/hr";
import { revisionLabel } from "./format";
import { consultationMessages as t } from "./messages.hr";
import styles from "./consultation-records.module.css";

function versionOptions(versions: VersionsPage["versions"]) {
  const options = new Map<number, string>();
  for (const version of versions) {
    if (options.has(version.revision)) continue;
    const label = version.kind === "submission" ? t.submittedVersion : t.savedVersion;
    options.set(version.revision, label.replace("{version}", revisionLabel(version.revision))
      .replace("{date}", formatDateTimeHr(version.savedMinute)));
  }
  return Array.from(options, ([revision, label]) => ({ value: String(revision), label }));
}

export function NewConsultation({ documentId, cancelHref, onSaved }: {
  documentId: string;
  cancelHref: string;
  onSaved: (record: ConsultationRecord) => void;
}) {
  const [versions, setVersions] = useState<VersionsPage["versions"]>([]);
  const [next, setNext] = useState<number | null>(null);
  const [request, setRequest] = useState<{ before: number | null }>({ before: null });
  const [loading, setLoading] = useState(true);
  const [versionError, setVersionError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pending = useRef(false);
  const options = versionOptions(versions);

  useEffect(() => {
    let active = true;
    void readConsultationVersions(documentId, request.before).then((page) => {
      if (!active) return;
      setLoading(false);
      setVersionError(page === null);
      if (page !== null) {
        setVersions((current) => [...current, ...page.versions]);
        setNext(page.nextBeforeRevision);
      }
    });
    return () => { active = false; };
  }, [documentId, request]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current) return;
    const fields = new FormData(event.currentTarget);
    const heldOn = String(fields.get("heldOn") ?? "");
    const choice = String(fields.get("revision") ?? "");
    const topic = String(fields.get("topic") ?? "").trim();
    const agreement = String(fields.get("agreement") ?? "").trim();
    if (!heldOn || !options.some(({ value }) => value === choice)) return setError(t.needDateAndVersion);
    if (!topic) return setError(t.needTopic);
    pending.current = true;
    setSaving(true);
    setError(null);
    const saved = await saveConsultation(documentId, { heldOn, revision: Number(choice), topic, agreement });
    if (saved !== null) {
      onSaved(saved);
      return;
    }
    pending.current = false;
    setSaving(false);
    setError(t.recordError);
  }

  return (
    <section className={styles.panel} aria-labelledby="nova-konzultacija">
      <h2 id="nova-konzultacija">{t.new}</h2>
      <form onSubmit={submit}>
        <fieldset className={styles.fields} disabled={saving} aria-label={t.new}>
          <div className={styles.pair}>
            <TextField label={t.date} name="heldOn" type="date" required />
            <Select label={t.version} name="revision" placeholder={t.pickVersion} options={options}
              disabled={options.length === 0} required />
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
          <TextField label={t.topic} name="topic" required />
          <TextArea label={t.agreement} name="agreement" />
          <p className={styles.hint}>{t.recordHint}</p>
          {error !== null && <p role="alert" className={styles.error}>{error}</p>}
          <div className={styles.actions}>
            <Button type="submit" disabled={options.length === 0}>{saving ? t.saving : t.save}</Button>
            {!saving && <Link href={cancelHref}>{t.cancel}</Link>}
          </div>
        </fieldset>
      </form>
    </section>
  );
}
