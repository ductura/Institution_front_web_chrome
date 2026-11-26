"use client";

import { useCallback, useEffect, useState } from "react";
import { Button, Card, Checkbox, DataTable, RouteLoading } from "@ductura/ui";

import { createApi, goToSignIn } from "@/client/api";
import { downloadBlob } from "../../../../../../src/components/editor/EarlierDraft";
import { appHref } from "../../../../../../src/components/shell/nav";
import { useHost } from "../../context";
import { questionnaireExportText as t } from "./messages.hr";
import {
  CSV_FILE, JSON_FILE, QUESTIONNAIRE_EXPORT_MIN_RESPONSES, exportPath, exportedVariables, fill, textVariables, toCsv, toJson,
  type QuestionnaireExport,
} from "./model";
import { readExport, readTitle, type ExportRead } from "./read";

type Api = ReturnType<typeof createApi>;
const defaultCall = (): Api => createApi();
const MIN = QUESTIONNAIRE_EXPORT_MIN_RESPONSES;

/**
 * Teacher: "Izvoz odgovora upitnika" (WEB-V18-UPITNIK-IZVOZ). The number of responses, the rule of the least
 * number, free text only after an explicit confirmation, and the JSON and CSV built on the device. No chart and
 * no comparison of respondents. Loading, error, "too few" and "not found" are different states, and the note of
 * a download follows only the file being prepared. `call` is for tests.
 */
export default function QuestionnaireExportPage({ questionnaireId, call = defaultCall }: { questionnaireId: string; call?: () => Api }) {
  const { base } = useHost();
  const here = appHref(base, exportPath(questionnaireId));
  const [title, setTitle] = useState<string | null>(null);
  const [read, setRead] = useState<ExportRead | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [confirmed, setConfirmed] = useState(false);
  const [loadingText, setLoadingText] = useState(false);
  const [note, setNote] = useState<{ tone: "status" | "alert"; text: string } | null>(null);

  // The title only names the page; where it cannot be read the export still works.
  useEffect(() => {
    let live = true;
    setTitle(null);
    void readTitle(call(), questionnaireId).then((r) => {
      if (!live) return;
      if (r.kind === "signedOut") goToSignIn(here);
      if (r.kind === "ok") setTitle(r.title);
    });
    return () => { live = false; };
    // `call` and `here` are stable per visit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questionnaireId, attempt]);

  useEffect(() => {
    let live = true;
    setRead(null);
    setConfirmed(false);
    setNote(null);
    void readExport(call(), questionnaireId, false).then((r) => {
      if (!live) return;
      if (r.kind === "signedOut") goToSignIn(here);
      setRead(r);
    });
    return () => { live = false; };
    // `call` and `here` are stable per visit; the id and the attempt are what ask again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questionnaireId, attempt]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);
  const back = <p><a href={appHref(base, "/nastavnik/kolegiji")}><span aria-hidden="true">← </span>{t.back}</a></p>;
  const head = <header><h1>{t.title}</h1><p>{t.lead}</p></header>;

  if (read === null || read.kind === "signedOut") return <div className="page">{back}{head}<RouteLoading label={t.loading} /></div>;
  if (read.kind === "notFound") {
    return <div className="page">{back}{head}<Card level={2} title={t.notFound.title}><p role="alert">{t.notFound.body}</p></Card></div>;
  }
  if (read.kind === "unavailable") {
    return (
      <div className="page">{back}{head}
        <Card level={2} title={t.countTitle}>
          <p role="alert">{t.unavailable}</p>
          <p><Button tone="quiet" onClick={reload}>{t.retry}</Button></p>
        </Card>
      </div>
    );
  }
  const titleLine = title === null ? null : <p>{fill(t.forTitle, { title })}</p>;
  if (read.kind === "tooFew") {
    return (
      <div className="page">{back}{head}{titleLine}
        <Card level={2} title={t.tooFew.title}><p role="status">{fill(t.tooFew.body, { min: MIN })}</p><p>{t.noName}</p></Card>
      </div>
    );
  }

  const data: QuestionnaireExport = read.data;
  const hasText = textVariables(data).length > 0;

  function offer(build: () => string, type: string, file: string) {
    try {
      downloadBlob(new Blob([build()], { type }), file);
      setNote({ tone: "status", text: t.downloaded });
    } catch {
      setNote({ tone: "alert", text: t.downloadFailed });
    }
  }

  async function withText(include: boolean) {
    setLoadingText(true);
    setNote(null);
    const next = await readExport(call(), questionnaireId, include);
    setLoadingText(false);
    if (next.kind === "signedOut") { goToSignIn(here); return; }
    if (next.kind === "ok") { setRead(next); setConfirmed(false); return; }
    // Anything else keeps the export on screen and says so: a failed read never turns into "no text".
    setNote({ tone: "alert", text: t.textLoadFailed });
  }

  return (
    <div className="page">
      {back}{head}{titleLine}
      {note !== null && (note.tone === "alert" ? <p role="alert">{note.text}</p> : <p role="status">{note.text}</p>)}
      <Card level={2} title={t.countTitle}>
        <p>{fill(t.countLine, { n: data.responseCount })}</p>
        <p>{fill(t.minNote, { min: MIN })}</p>
        <p>{t.noName}</p>
      </Card>
      <Card level={2} title={t.variablesTitle}>
        <DataTable caption={t.variablesCaption} rows={exportedVariables(data)} rowKey={(v) => v.questionId} empty={t.textNone}
          columns={[
            { id: "order", header: t.colOrder, numeric: true, cell: (v) => String(v.order) },
            { id: "label", header: t.colLabel, rowHeader: true, cell: (v) => v.label },
            { id: "kind", header: t.colKind, cell: (v) => t.kinds[v.kind] },
          ]} />
      </Card>
      <Card level={2} title={t.textTitle}>
        {!hasText ? <p>{t.textNone}</p> : (
          <>
            <p role="status">{data.includesText ? t.textOn : t.textOff}</p>
            <p>{t.textWarn}</p>
            {data.includesText ? (
              <p><Button tone="quiet" disabled={loadingText} onClick={() => void withText(false)}>{t.textDrop}</Button></p>
            ) : (
              <>
                <Checkbox label={t.textConfirm} checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
                <p><Button tone="secondary" disabled={!confirmed || loadingText} onClick={() => void withText(true)}>{t.textLoad}</Button></p>
              </>
            )}
          </>
        )}
      </Card>
      <Card level={2} title={t.downloadTitle}>
        <p>{t.fileNote}</p>
        <p>
          <Button onClick={() => offer(() => toJson(data), "application/json;charset=utf-8", JSON_FILE)}>{t.downloadJson}</Button>{" "}
          <Button tone="quiet" onClick={() => offer(() => toCsv(data, t.csvOrderHead), "text/csv;charset=utf-8", CSV_FILE)}>{t.downloadCsv}</Button>
        </p>
      </Card>
    </div>
  );
}
