"use client";

import { useCallback, useEffect, useState } from "react";
import { Button, Card, RouteLoading, DataTable, Select } from "@ductura/ui";

import { createApi, goToSignIn } from "@/client/api";
import { downloadBlob } from "../../../../../../src/components/editor/EarlierDraft";
import { appHref } from "../../../../../../src/components/shell/nav";
import { useHost } from "../../context";
import { qualExportText as t } from "./messages.hr";
import { countsByCode, CSV_CODEBOOK_FILE, CSV_SEGMENTS_FILE, JSON_FILE, toCodebookCsv, toJson, toSegmentsCsv, totalSegments } from "./model";
import { readExport, readMaterialChoices, type ExportRead, type MaterialChoice } from "./read";

type Api = ReturnType<typeof createApi>;
const defaultCall = (): Api => createApi();
const ALL = "";

/**
 * Student: "Izvoz kodiranja" (WEB-V18-KODIRANJE-IZVOZ). The student's own codebook and marked passages as JSON
 * and CSV, built on the device from the server's answer, with the counts in the order of the codebook (never by
 * size). Private to the student; another's material is "not found". No suggestion of codes (V18-3). Loading,
 * error and empty are three different states, and the note of a download follows only the file being prepared.
 * `call` is for tests.
 */
export default function QualExportPage({ call = defaultCall }: { call?: () => Api }) {
  const { base } = useHost();
  const here = appHref(base, "/zadaci/kodiranje-izvoz");
  const [scope, setScope] = useState(ALL);
  const [choices, setChoices] = useState<readonly MaterialChoice[]>([]);
  const [read, setRead] = useState<ExportRead | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [note, setNote] = useState<{ tone: "status" | "alert"; text: string } | null>(null);

  // The materials only fill the choice; where they cannot be read the export of all material still works.
  useEffect(() => {
    let live = true;
    void readMaterialChoices(call()).then((result) => {
      if (!live) return;
      if (result.kind === "signedOut") goToSignIn(here);
      if (result.kind === "ok") setChoices(result.materials);
    });
    return () => { live = false; };
    // `call` and `here` are stable per visit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let live = true;
    setRead(null);
    void readExport(call(), scope === ALL ? null : scope).then((result) => {
      if (!live) return;
      if (result.kind === "signedOut") goToSignIn(here);
      if (result.kind === "notFound" && scope !== ALL) {
        // The material is gone (or was never the student's): back to all of it, with a note.
        setChoices((all) => all.filter((m) => m.id !== scope));
        setScope(ALL);
        setNote({ tone: "alert", text: t.scopeGone });
        return;
      }
      setRead(result);
    });
    return () => { live = false; };
    // `call` and `here` are stable per visit; the scope and the attempt are what ask again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, attempt]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);
  const back = <p><a href={appHref(base, "/zadaci")}><span aria-hidden="true">← </span>{t.back}</a></p>;
  const head = <header><h1>{t.title}</h1><p>{t.lead}</p></header>;

  if (read === null || read.kind === "signedOut") return <div className="page">{back}{head}<RouteLoading label={t.loading} /></div>;
  if (read.kind === "unavailable" || read.kind === "notFound") {
    return (
      <div className="page">{back}{head}
        <Card level={2} title={t.countsTitle}>
          <p role="alert">{t.unavailable}</p>
          <p><Button tone="quiet" onClick={reload}>{t.retry}</Button></p>
        </Card>
      </div>
    );
  }

  const data = read.data;
  const counts = countsByCode(data);
  const empty = data.codebook.length === 0 && data.segments.length === 0;

  function offer(build: () => string, type: string, file: string) {
    try {
      downloadBlob(new Blob([build()], { type }), file);
      setNote({ tone: "status", text: t.downloaded });
    } catch {
      setNote({ tone: "alert", text: t.downloadFailed });
    }
  }

  return (
    <div className="page">
      {back}{head}
      {note !== null && (note.tone === "alert" ? <p role="alert">{note.text}</p> : <p role="status">{note.text}</p>)}
      {choices.length > 0 && (
        <Select label={t.scopeLabel} value={scope} options={[{ value: ALL, label: t.scopeAll }, ...choices.map((m) => ({ value: m.id, label: m.title }))]}
          onChange={(e) => { setNote(null); setScope(e.target.value); }} />
      )}
      {empty ? (
        <Card level={2} title={t.countsTitle}><h3>{t.empty.title}</h3><p>{t.empty.body}</p></Card>
      ) : (
        <>
          <Card level={2} title={t.countsTitle}>
            <p>{t.countsHint}</p>
            <p>{t.summary.replace("{codes}", String(counts.length)).replace("{segments}", String(totalSegments(data)))}</p>
            {/* No sortValue: the table never sorts, so the codebook's order stays (V18-8). */}
            <DataTable caption={t.countsCaption} rows={counts} rowKey={(c) => c.code} empty={t.empty.title}
              columns={[
                { id: "code", header: t.colCode, rowHeader: true, cell: (c) => c.name },
                { id: "description", header: t.colDescription, cell: (c) => (c.description === "" ? t.noDescription : c.description) },
                { id: "n", header: t.colCount, numeric: true, cell: (c) => String(c.n) },
              ]} />
          </Card>
          <Card level={2} title={t.downloadTitle}>
            <p>{t.fileNote}</p>
            <p>
              <Button onClick={() => offer(() => toJson(data), "application/json;charset=utf-8", JSON_FILE)}>{t.downloadJson}</Button>{" "}
              <Button tone="quiet" onClick={() => offer(() => toSegmentsCsv(data, t.csvSegmentsHead), "text/csv;charset=utf-8", CSV_SEGMENTS_FILE)}>{t.downloadCsvSegments}</Button>{" "}
              <Button tone="quiet" onClick={() => offer(() => toCodebookCsv(data, t.csvCodebookHead), "text/csv;charset=utf-8", CSV_CODEBOOK_FILE)}>{t.downloadCsvCodebook}</Button>
            </p>
          </Card>
        </>
      )}
    </div>
  );
}
