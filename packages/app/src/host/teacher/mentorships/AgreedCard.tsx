"use client";

// WEB-NF6-ETAPE (NF-6 MK-5, odluka 1: piše samo mentor, student čita): "Dogovoreno na konzultacijama" of one
// work on N-16, from the latest record of the consultation log (work.consultation-records.get). Tasks with
// check boxes are not in the contract (SRV-MENTOR-5): the card says so and leads to the log, where the
// mentor writes the agreement as text. A failed read says "unavailable", never "none".
import { Button, Card } from "@ductura/ui";
import { useEffect, useState } from "react";

import { readConsultations, type ConsultationRecord } from "../../../../../../src/client/consultation-records";
import { appHref } from "../../../../../../src/components/shell/nav";
import { mentorPlanText } from "./messages.hr";
import { dayText, latestRecord } from "./model";

const t = mentorPlanText.agreed;
export type RecordsRead = (documentId: string) => Promise<readonly ConsultationRecord[] | null>;

export function AgreedCard({ documentId, base, read = readConsultations }: { documentId: string; base: string; read?: RecordsRead }) {
  const [records, setRecords] = useState<readonly ConsultationRecord[] | null | undefined>(undefined);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let live = true;
    setRecords(undefined);
    void read(documentId).catch(() => null).then((value) => { if (live) setRecords(value); });
    return () => { live = false; };
  }, [read, documentId, attempt]);

  const last = records ? latestRecord(records) : null;
  return (
    <Card title={t.title} busy={records === undefined}>
      {records === undefined && <p role="status">{t.loading}</p>}
      {records === null && (
        <>
          <p role="alert">{t.unavailable}</p>
          <p><Button tone="quiet" onClick={() => setAttempt((n) => n + 1)}>{t.retry}</Button></p>
        </>
      )}
      {records && last === null && <p>{t.empty}</p>}
      {last !== null && (
        <>
          <p>{t.last.replace("{date}", dayText(last.heldOn)).replace("{topic}", last.topic)}</p>
          <p>{last.agreement.trim() === "" ? t.nothing : last.agreement}</p>
          {last.additions.length > 0 && (
            <>
              <p>{t.additions}</p>
              <ul>{last.additions.map((addition) => <li key={addition.id}>{addition.text}</li>)}</ul>
            </>
          )}
        </>
      )}
      <p>{t.tasks}</p>
      <p><a href={appHref(base, `/nastavnik/rad/${encodeURIComponent(documentId)}/konzultacije`)}>{t.openRecords}</a></p>
    </Card>
  );
}
