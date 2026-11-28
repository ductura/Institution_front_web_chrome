"use client";

import { Button, DataTable, Skeleton } from "@ductura/ui";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { goToSignIn } from "../../../client/api";
import { readConsultationList, type ConsultationRecord } from "../../../client/consultation-records";
import LoadAlert, { DeniedState, NotFoundState } from "../../shell/LoadAlert";
import { ConsultationDetail } from "./ConsultationDetail";
import { NewConsultation } from "./NewConsultation";
import { consultationDate, revisionLabel } from "./format";
import { consultationMessages as t } from "./messages.hr";
import styles from "./consultation-records.module.css";

export function ConsultationRecords({ documentId, workHref }: { documentId: string; workHref: string }) {
  const router = useRouter();
  const search = useSearchParams();
  const recordId = search.get("zapis");
  const path = `${workHref}/konzultacije`;
  const recordHref = (id: string) => `${path}?zapis=${encodeURIComponent(id)}`;
  const [records, setRecords] = useState<ConsultationRecord[] | null>();
  const [blocked, setBlocked] = useState<"forbidden" | "not-found" | null>(null);
  const [retry, setRetry] = useState(0);
  const [createdId, setCreatedId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void readConsultationList(documentId).then((answer) => {
      if (!active) return;
      // Design alignment 27. 11. 2026. (N-11): 401, 403 and 404 are not a read error.
      if (answer.kind === "unauthorized") return goToSignIn(path);
      if (answer.kind === "forbidden" || answer.kind === "not-found") return setBlocked(answer.kind);
      setRecords(answer.kind === "ready" ? [...answer.records] : null);
    });
    return () => { active = false; };
  }, [documentId, retry, path]);

  if (blocked === "forbidden") return <div className="page"><DeniedState /></div>;
  if (blocked === "not-found") return <div className="page"><NotFoundState /></div>;
  const record = records?.find(({ id }) => recordId === id);
  return (
    <div className={`page ${styles.page}`}>
      <Link href={workHref}>{t.backToWork}</Link>
      <h1>{t.title}</h1>
      {records === undefined ? <Skeleton label={t.loading} /> : records === null ? (
        // Design alignment 27. 11. 2026. (K6): the alert box with the link under it, not a button.
        <LoadAlert retry={{ label: t.retry, onRetry: () => { setRecords(undefined); setRetry((count) => count + 1); } }}>{t.readError}</LoadAlert>
      ) : search.has("novi") ? (
        <NewConsultation documentId={documentId} cancelHref={path} onSaved={(saved) => {
          setRecords((current) => [...(current ?? []), saved]);
          setCreatedId(saved.id);
          router.replace(recordHref(saved.id));
        }} />
      ) : recordId !== null ? (
        <>
          <Link href={path} onClick={() => setCreatedId(null)}>{t.allRecords}</Link>
          {record === undefined ? <p role="alert">{t.missingRecord}</p> : (
            <ConsultationDetail key={record.id} documentId={documentId} record={record} justCreated={createdId === record.id}
              onAdded={(addition) => setRecords((current) => current?.map((item) => item.id === record.id
                ? { ...item, additions: [...item.additions, addition] } : item))} />
          )}
        </>
      ) : (
        <>
          {records.length === 0 ? <p>{t.empty}</p> : (
            <DataTable caption={t.list} rowKey={(item) => item.id}
              rows={records.toSorted((first, second) => second.heldOn.localeCompare(first.heldOn))}
              empty={t.empty} columns={[
                { id: "date", header: t.date, cell: (item) => <time dateTime={item.heldOn}>{consultationDate(item.heldOn)}</time> },
                { id: "topic", header: t.topic, rowHeader: true, cell: (item) => <Link href={recordHref(item.id)} prefetch={false}>{item.topic}</Link> },
                { id: "revision", header: t.version, cell: (item) => revisionLabel(item.revision) },
              ]} />
          )}
          <div><Button onClick={() => { setCreatedId(null); router.push(`${path}?novi=1`); }}>{t.new}</Button></div>
        </>
      )}
    </div>
  );
}
