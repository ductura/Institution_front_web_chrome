"use client";

import { Button, DataTable, Dialog, Select, TextArea, type DataTableColumn } from "@ductura/ui";
import { useEffect, useRef, useState } from "react";

import { appHref } from "@/components/index";
import { goToSignIn } from "@/client/api";

import { readAcademicYears, readAdminCourses, type InstitutionCourse } from "../../institution/reads";
import { useHost } from "../../context";
import { LoadAlert } from "../../states/States";
import styles from "./isvu.module.css";
import { countByStatus, countsSummary, hasNewStudents, reasonText, statusText } from "./model";
import { csvImportMessages as t, isvuImportMessages as m, isvuPageMessages as p } from "./messages.hr";
import { confirmImport, previewCsvImport, type CsvImportPreview, type CsvRejection, type CsvSource, type Failure, type ImportResult } from "./reads";

type Row = CsvImportPreview["rows"][number];
type Load = "loading" | "ready" | "empty" | Failure;
type Shown =
  | { kind: "none" } | { kind: "busy" } | { kind: "preview"; value: CsvImportPreview }
  | { kind: "failed"; failure: Failure } | { kind: "rejected"; reason: CsvRejection };

/**
 * F4-OPE-R05: the administrator's CSV roster import. Same review as the trial source: a read failure is its own state, a
 * preview enrols nobody, the confirmation is a dialog, a failed confirmation keeps the preview.
 */
export default function CsvImport({ onDenied }: { readonly onDenied?: () => void } = {}) {
  const { base } = useHost();
  const [years, setYears] = useState<readonly string[]>([]);
  const [year, setYear] = useState("");
  const [load, setLoad] = useState<Load>("loading");
  const [attempt, setAttempt] = useState(0);
  const [courses, setCourses] = useState<readonly InstitutionCourse[]>([]);
  const [courseId, setCourseId] = useState("");
  const [source, setSource] = useState<CsvSource>("merlin");
  const [csv, setCsv] = useState("");
  const [shown, setShown] = useState<Shown>({ kind: "none" });
  const [asking, setAsking] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState<string | undefined>(undefined);
  const [result, setResult] = useState<ImportResult | null>(null);
  const ticket = useRef(0);
  const previewTicket = useRef(0);
  const sending = useRef(false);
  const alive = useRef(false);

  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; ticket.current += 1; previewTicket.current += 1; };
  }, []);

  useEffect(() => {
    const mine = ++ticket.current;
    previewTicket.current += 1;
    setLoad("loading"); setCourses([]); setShown({ kind: "none" }); setResult(null); setCourseId("");
    void (async () => {
      if (year === "") {
        const y = await readAcademicYears();
        if (mine !== ticket.current) return;
        if (y.kind !== "ok") { setLoad(y.kind); return; }
        setYears(y.value);
        if (y.value.length === 0) { setLoad("empty"); return; }
        setYear(y.value[0]!);
        return; // the year effect re-runs with it
      }
      const own = await readAdminCourses(year);
      if (mine !== ticket.current) return;
      if (own.kind !== "ok") { setLoad(own.kind); return; }
      setCourses(own.value);
      setLoad(own.value.length === 0 ? "empty" : "ready");
    })();
  }, [year, attempt]);
  useEffect(() => { if (load === "signedOut") goToSignIn(appHref(base, "/ustanova/isvu")); }, [load, base]);
  useEffect(() => { if (load === "denied") onDenied?.(); }, [load, onDenied]);

  const changed = () => { previewTicket.current += 1; setShown({ kind: "none" }); setResult(null); };
  const ready = courseId !== "" && csv.trim() !== "" && shown.kind !== "busy";

  const runPreview = async () => {
    if (!ready) return;
    const mine = ++previewTicket.current;
    setShown({ kind: "busy" }); setResult(null);
    const r = await previewCsvImport(courseId, source, csv);
    if (!alive.current || mine !== previewTicket.current) return; // the input changed meanwhile: this answer is for another list
    if (r.kind === "signedOut" || r.kind === "denied") { setLoad(r.kind); return; }
    if (r.kind === "ok") setShown({ kind: "preview", value: r.value });
    else if (r.kind === "rejected") setShown({ kind: "rejected", reason: r.reason });
    else setShown({ kind: "failed", failure: r.kind });
  };

  const runConfirm = async () => {
    if (shown.kind !== "preview" || sending.current) return;
    sending.current = true; setConfirming(true); setConfirmError(undefined);
    const r = await confirmImport(shown.value.importId);
    sending.current = false;
    if (!alive.current) return;
    setConfirming(false);
    if (r.kind === "signedOut" || r.kind === "denied") { setAsking(false); setLoad(r.kind); return; }
    if (r.kind === "ok") { setAsking(false); setResult(r.value); setShown({ kind: "none" }); return; }
    if (r.kind === "expired" || r.kind === "disabled") { setAsking(false); setShown({ kind: "failed", failure: r.kind }); return; }
    setConfirmError(t.confirmFailed); // the preview stays
  };

  const columns: DataTableColumn<Row>[] = [
    { id: "line", header: p.colLine, cell: (r) => String(r.line) },
    { id: "name", header: p.colName, cell: (r) => `${r.givenName} ${r.familyName}`.trim(), rowHeader: true },
    { id: "id", header: p.colIdentifier, cell: (r) => r.identifier },
    { id: "status", header: p.colStatus, cell: (r) => statusText(r.status) },
    { id: "reason", header: p.colReason, cell: (r) => (r.status === "unsuitable" ? reasonText(r.reason) : p.noReason) },
  ];

  if (load === "signedOut" || load === "denied") return null;
  const failureText = (f: Failure): string => (f === "expired" ? m.expired : f === "disabled" ? t.courseNotFound : m.readError);

  return (
    <section aria-label={t.heading} className={styles.stack}>
      <h2>{t.heading}</h2>
      <p>{t.lead}</p>
      {load === "loading" && <p role="status">{m.loading}</p>}
      {(load === "disabled" || load === "expired") && <LoadAlert body={t.loadError} />}
      {load === "unavailable" && <LoadAlert body={t.loadError} retry={{ label: t.retry, onRetry: () => setAttempt((n) => n + 1) }} />}
      {years.length > 0 && load !== "unavailable" && (
        <Select label={t.yearLabel} name="csv-year" value={year} options={years.map((y) => ({ value: y, label: y }))} onChange={(e) => setYear(e.target.value)} />
      )}
      {load === "empty" && <p role="status">{t.noCourses}</p>}
      {load === "ready" && (
        <>
          <div className={styles.row}>
            <Select label={t.courseLabel} name="csv-course" value={courseId} placeholder={t.choose}
              options={courses.map((c) => ({ value: c.courseId, label: c.name }))} onChange={(e) => { changed(); setCourseId(e.target.value); }} />
            <Select label={t.sourceLabel} name="csv-source" value={source}
              options={[{ value: "merlin", label: t.sourceMerlin }, { value: "isvu", label: t.sourceIsvu }]}
              onChange={(e) => { changed(); setSource(e.target.value === "isvu" ? "isvu" : "merlin"); }} />
          </div>
          <TextArea label={t.csvLabel} hint={t.csvHint} name="csv-text" rows={8} value={csv}
            onChange={(e) => { changed(); setCsv(e.currentTarget.value); }} />
          <div className={styles.row}>
            <Button busy={shown.kind === "busy"} aria-disabled={ready ? undefined : true} onClick={() => void runPreview()}>
              {shown.kind === "busy" ? t.previewing : t.preview}
            </Button>
          </div>
          {shown.kind === "rejected" && <LoadAlert body={t[shown.reason]} />}
          {shown.kind === "failed" && (
            <div className={styles.stack}>
              <LoadAlert body={failureText(shown.failure)} />
              {shown.failure === "expired" && <div className={styles.row}><Button onClick={() => void runPreview()}>{t.newPreview}</Button></div>}
            </div>
          )}
          {shown.kind === "preview" && (() => {
            const counts = countByStatus(shown.value.rows);
            return (
              <section aria-label={t.previewHeading} className={styles.stack}>
                <h3>{t.previewHeading}</h3>
                <ul className={styles.counts}>{countsSummary(counts).map((c) => <li key={c}>{c}</li>)}</ul>
                <DataTable caption={t.caption} columns={columns} rows={shown.value.rows} rowKey={(r) => `${r.line}:${r.identifier}`} empty={m.empty} />
                {hasNewStudents(counts)
                  ? <Button onClick={() => { setConfirmError(undefined); setAsking(true); }}>{t.confirm}</Button>
                  : <p role="status">{t.noNew}</p>}
              </section>
            );
          })()}
          {result !== null && (
            <section aria-label={t.resultHeading}>
              <h3>{t.resultHeading}</h3>
              <ul className={styles.counts}>
                <li>{p.result.enrolled(result.enrolled)}</li>
                <li>{p.result.alreadyEnrolled(result.alreadyEnrolled)}</li>
                <li>{p.result.skipped(result.skipped)}</li>
              </ul>
              {result.alreadyConfirmed && <p role="status">{p.alreadyConfirmed}</p>}
            </section>
          )}
          <Dialog open={asking && shown.kind === "preview"} title={t.dialogTitle} dismissible={!confirming}
            onClose={() => setAsking(false)}
            actions={<>
              <Button tone="secondary" onClick={() => setAsking(false)} aria-disabled={confirming || undefined}>{t.dialogCancel}</Button>
              <Button busy={confirming} onClick={() => void runConfirm()}>{confirming ? t.confirming : t.dialogConfirm}</Button>
            </>}>
            <p>{shown.kind === "preview" ? t.dialogBody(countByStatus(shown.value.rows).new) : ""}</p>
            {confirmError !== undefined && <LoadAlert body={confirmError} />}
          </Dialog>
        </>
      )}
    </section>
  );
}
