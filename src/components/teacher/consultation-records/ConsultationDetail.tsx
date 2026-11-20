import { Button, TextArea } from "@ductura/ui";
import { useRef, useState, type FormEvent } from "react";

import {
  addConsultationNote, type ConsultationAddition, type ConsultationRecord,
} from "../../../client/consultation-records";
import { formatDateTimeHr } from "../../../lib/i18n/hr";
import { consultationDate, revisionLabel } from "./format";
import { consultationMessages as t } from "./messages.hr";
import styles from "./consultation-records.module.css";

export function ConsultationDetail({ documentId, record, justCreated, onAdded }: {
  documentId: string;
  record: ConsultationRecord;
  justCreated: boolean;
  onAdded: (addition: ConsultationAddition) => void;
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
    const text = String(new FormData(form).get("text") ?? "").trim();
    if (!text) return setNotice({ kind: "alert", text: t.needAddition });
    pending.current = true;
    setSaving(true);
    setNotice(null);
    const addition = await addConsultationNote(documentId, record.id, text);
    pending.current = false;
    setSaving(false);
    if (addition === null) {
      setNotice({ kind: "alert", text: t.additionError });
      return;
    }
    onAdded(addition);
    form.reset();
    setNotice({ kind: "status", text: t.additionSaved });
  }

  return (
    <section className={styles.panel} aria-labelledby="zapis-konzultacije">
      <h2 id="zapis-konzultacije">{t.readOne.replace("{date}", consultationDate(record.heldOn))}</h2>
      <dl className={styles.facts}>
        <dt>{t.topic}</dt><dd>{record.topic}</dd>
        <dt>{t.version}</dt><dd>{revisionLabel(record.revision)}</dd>
        <dt>{t.agreement}</dt><dd>{record.agreement || t.noAgreement}</dd>
      </dl>
      <section aria-labelledby="dopune-konzultacije">
        <h3 id="dopune-konzultacije">{t.additions}</h3>
        {record.additions.length === 0 ? <p>{t.emptyAdditions}</p> : (
          <ul className={styles.additions}>
            {record.additions.map((addition) => (
              <li key={addition.id}>
                <time dateTime={addition.createdAt}>{formatDateTimeHr(addition.createdAt)}</time>
                <p>{addition.text}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
      <form onSubmit={submit}>
        <fieldset className={styles.fields} disabled={saving} aria-label={t.additionText}>
          <TextArea label={t.additionText} name="text" rows={3} required />
          {notice !== null && <p role={notice.kind} className={notice.kind === "alert" ? styles.error : undefined}>{notice.text}</p>}
          <div><Button type="submit">{saving ? t.saving : t.add}</Button></div>
        </fieldset>
      </form>
    </section>
  );
}
