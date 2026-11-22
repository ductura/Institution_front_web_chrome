"use client";

import { StudentDataDownload, type StudentDataDownloadState } from "@ductura/ui";
import { useState } from "react";

import { appHref } from "@/components/shell/nav";
import { downloadBlob } from "@/components/editor/EarlierDraft";
import { downloadStudentDataExport, type DownloadOutcome } from "@/client/student-data-export";
import { messagesHr as app } from "../../../../../../locales/hr.ts";

import { useHost } from "../../context";
import { studentDataDownloadMessages as t } from "./messages.hr";

export type Download = (token: string) => Promise<DownloadOutcome>;
export type Save = (blob: Blob, filename: string) => void;

/** One press of the button: saves the file on `ready`, and says what the page shows next. */
export async function runDownload(token: string, download: Download, save: Save): Promise<StudentDataDownloadState> {
  const out = await download(token);
  if (out.kind === "ready") {
    save(new Blob([out.bytes], { type: out.type }), out.filename);
    return { kind: "done" };
  }
  return out.kind === "gone" ? { kind: "gone" } : { kind: "error", message: t.unavailable };
}

/**
 * /izvoz-podataka/[token] (WEB-1302; SRV-1308): the student's one-time download. Public: the link
 * carries the token and no session is read. The link works once, so nothing is fetched before
 * the button is pressed; after a 410 the page only says the link is gone, never why.
 */
export default function StudentDataDownloadPage({ token, download = (x) => downloadStudentDataExport(x), save = downloadBlob }: {
  token: string; download?: Download; save?: Save;
}) {
  const { base } = useHost();
  const [state, setState] = useState<StudentDataDownloadState>({ kind: "idle" });

  const start = async () => {
    setState({ kind: "busy" });
    setState(await runDownload(token, download, save));
  };

  return (
    <main id="sadrzaj" tabIndex={-1} className="page">
      <header>
        <a href={appHref(base, "/")}>{app.app.name}</a>
        <h1>{t.labels.title}</h1>
      </header>
      <StudentDataDownload labels={t.labels} state={state} onDownload={() => { void start(); }} />
    </main>
  );
}
