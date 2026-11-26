"use client";

import { Button, DataTable, Dialog, Notice, Select, type DataTableColumn } from "@ductura/ui";
import { useEffect, useRef, useState } from "react";

import { appHref } from "@/components/index";
import { goToSignIn } from "@/client/api";

import { readAcademicYears, readAdminCourses, type InstitutionCourse } from "../../institution/reads";
import { useHost } from "../../context";
import styles from "./isvu.module.css";
import { countByStatus, countsSummary, hasNewStudents, reasonText, statusText } from "./model";
import { isvuImportMessages as m, isvuPageMessages as t } from "./messages.hr";
import { confirmImport, previewImport, readSourceCourses, type Failure, type ImportPreview, type ImportResult, type SourceCourse } from "./reads";

type Row = ImportPreview["rows"][number];
type Load = "loading" | "ready" | "empty" | Failure;
type Shown = { kind: "none" } | { kind: "busy" } | { kind: "preview"; value: ImportPreview } | { kind: "failed"; failure: Failure };

/**
 * WEB-V22-UVOZ-EKRAN: the administrator's trial ISVU import. A read failure is its own state (never "no data"); a preview
 * enrols nobody; the confirmation is a dialog and a failed confirmation keeps the preview.
 */
export default function IsvuPage() {
  const { base } = useHost();
  const [years, setYears] = useState<readonly string[]>([]);
  const [year, setYear] = useState("");
  const [load, setLoad] = useState<Load>("loading");
  const [attempt, setAttempt] = useState(0);
  const [courses, setCourses] = useState<readonly InstitutionCourse[]>([]);
  const [source, setSource] = useState<readonly SourceCourse[]>([]);
  const [courseId, setCourseId] = useState("");
  const [sourceKey, setSourceKey] = useState("");
  const [shown, setShown] = useState<Shown>({ kind: "none" });
  const [asking, setAsking] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState<string | undefined>(undefined);
  const [result, setResult] = useState<ImportResult | null>(null);
  const ticket = useRef(0);
  const sending = useRef(false);

  useEffect(() => {
    const mine = ++ticket.current;
    setLoad("loading"); setCourses([]); setSource([]); setShown({ kind: "none" }); setResult(null); setCourseId(""); setSourceKey("");
    void (async () => {
      let chosen = year;
      if (chosen === "") {
        const y = await readAcademicYears();
        if (mine !== ticket.current) return;
        if (y.kind !== "ok") { setLoad(y.kind); return; }
        setYears(y.value);
        if (y.value.length === 0) { setLoad("empty"); return; }
        chosen = y.value[0]!;
        setYear(chosen);
        return; // the year effect re-runs with it
      }
      const [own, src] = await Promise.all([readAdminCourses(chosen), readSourceCourses(chosen)]);
      if (mine !== ticket.current) return;
      if (own.kind !== "ok") { setLoad(own.kind); return; }
      if (src.kind !== "ok") { setLoad(src.kind); return; }
      setCourses(own.value); setSource(src.value);
      setLoad(own.value.length === 0 || src.value.length === 0 ? "empty" : "ready");
    })();
  }, [year, attempt]);
  useEffect(() => {
    if (load === "signedOut") goToSignIn(appHref(base, "/ustanova/isvu"));
  }, [load, base]);

  const pick = (setter: (v: string) => void) => (v: string) => { setter(v); setShown({ kind: "none" }); setResult(null); };

  const runPreview = async () => {
    if (courseId === "" || sourceKey === "" || shown.kind === "busy") return;
    setShown({ kind: "busy" }); setResult(null);
    const r = await previewImport(courseId, sourceKey);
    setShown(r.kind === "ok" ? { kind: "preview", value: r.value } : { kind: "failed", failure: r.kind });
  };

  const runConfirm = async () => {
    if (shown.kind !== "preview" || sending.current) return;
    sending.current = true; setConfirming(true); setConfirmError(undefined);
    const r = await confirmImport(shown.value.importId);
    sending.current = false; setConfirming(false);
    if (r.kind === "ok") { setAsking(false); setResult(r.value); setShown({ kind: "none" }); return; }
    if (r.kind === "expired") { setAsking(false); setShown({ kind: "failed", failure: "expired" }); return; }
    if (r.kind === "disabled") { setAsking(false); setShown({ kind: "failed", failure: "disabled" }); return; }
    setConfirmError(t.confirmFailed); // the preview stays
  };

  const columns: DataTableColumn<Row>[] = [
    { id: "line", header: t.colLine, cell: (r) => String(r.line) },
    { id: "name", header: t.colName, cell: (r) => `${r.givenName} ${r.familyName}`.trim(), rowHeader: true },
    { id: "id", header: t.colIdentifier, cell: (r) => r.identifier },
    { id: "status", header: t.colStatus, cell: (r) => statusText(r.status) },
    { id: "reason", header: t.colReason, cell: (r) => (r.status === "unsuitable" ? reasonText(r.reason) : t.noReason) },
  ];

  if (load === "signedOut") return <p role="alert">{t.signedOut}</p>;
  if (load === "denied") return <p role="alert">{t.denied}</p>;

  const failureText = (f: Failure): string =>
    f === "expired" ? m.expired : f === "disabled" ? t.courseNotFound : f === "signedOut" ? t.signedOut : f === "denied" ? t.denied : m.readError;

  return (
    <div className={styles.stack}>
      <Notice tone="warn">{m.trialNotice}</Notice>
      <p>{t.lead}</p>
      {load === "loading" && <p role="status">{m.loading}</p>}
      {load === "disabled" && <p role="alert">{m.disabled}</p>}
      {load === "expired" && <p role="alert">{m.readError}</p>}
      {load === "unavailable" && (
        <div>
          <p role="alert">{m.readError}</p>
          <Button onClick={() => setAttempt((n) => n + 1)}>{t.retry}</Button>
        </div>
      )}
      {load === "empty" && <p role="status">{source.length === 0 && courses.length > 0 ? m.empty : t.noCourses}</p>}
      {load === "ready" && (
        <>
          <div className={styles.row}>
            <Select label={t.yearLabel} name="year" value={year} options={years.map((y) => ({ value: y, label: y }))} onChange={(e) => setYear(e.target.value)} />
            <Select label={t.courseLabel} name="course" value={courseId} placeholder={t.choose}
              options={courses.map((c) => ({ value: c.courseId, label: c.name }))} onChange={(e) => pick(setCourseId)(e.target.value)} />
            <Select label={t.sourceLabel} name="source" value={sourceKey} placeholder={t.choose}
              options={source.map((c) => ({ value: c.sourceCourseKey, label: `${c.name} (${c.enrolledCount})` }))} onChange={(e) => pick(setSourceKey)(e.target.value)} />
            <Button busy={shown.kind === "busy"} aria-disabled={courseId === "" || sourceKey === "" || shown.kind === "busy" ? true : undefined}
              onClick={() => void runPreview()}>{shown.kind === "busy" ? t.previewing : t.preview}</Button>
          </div>
          {shown.kind === "failed" && (
            <div>
              <p role="alert">{failureText(shown.failure)}</p>
              {shown.failure === "expired" && <Button onClick={() => void runPreview()}>{t.newPreview}</Button>}
            </div>
          )}
          {shown.kind === "preview" && (() => {
            const counts = countByStatus(shown.value.rows);
            return (
              <section aria-label={t.previewHeading} className={styles.stack}>
                <h2>{t.previewHeading}</h2>
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
              <h2>{t.resultHeading}</h2>
              <ul className={styles.counts}>
                <li>{t.result.enrolled(result.enrolled)}</li>
                <li>{t.result.alreadyEnrolled(result.alreadyEnrolled)}</li>
                <li>{t.result.skipped(result.skipped)}</li>
              </ul>
              {result.alreadyConfirmed && <p role="status">{t.alreadyConfirmed}</p>}
            </section>
          )}
          <Dialog open={asking && shown.kind === "preview"} title={t.dialogTitle} error={confirmError} dismissible={!confirming}
            onClose={() => setAsking(false)}
            actions={<>
              <Button tone="secondary" onClick={() => setAsking(false)} aria-disabled={confirming || undefined}>{t.dialogCancel}</Button>
              <Button busy={confirming} onClick={() => void runConfirm()}>{confirming ? t.confirming : t.dialogConfirm}</Button>
            </>}>
            <p>{shown.kind === "preview" ? t.dialogBody(countByStatus(shown.value.rows).new) : ""}</p>
          </Dialog>
        </>
      )}
    </div>
  );
}
