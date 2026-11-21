"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@ductura/ui";

import { requestWorkDocx, type WorkDocxResult } from "../../../../client/work-export";
import { downloadBlob } from "../../EarlierDraft";
import { docxDownloadMessages as t } from "./messages.hr";

export type SavedDocxVersion = {
  documentId: string;
  versionId: string;
  savedAt: string;
  title: string;
};

export type DocxVersion = SavedDocxVersion | "loading" | "unavailable" | null;

type State =
  | { kind: "idle" | "loading" }
  | { kind: "done"; hash: string }
  | { kind: "error"; reason: Extract<WorkDocxResult, { ok: false }>["reason"] };

const formatDate = new Intl.DateTimeFormat("hr-HR", {
  day: "numeric",
  month: "numeric",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Zagreb",
});

function docxFileName(title: string) {
  const name = title.trim().replace(/[<>:"/\\|?*\p{Cc}]/gu, "_").replace(/[. ]+$/u, "");
  return `${name || "rad"}.docx`;
}

function SavedVersionDownload({ version }: { version: SavedDocxVersion }) {
  const active = useRef<AbortController | null>(null);
  const [state, setState] = useState<State>({ kind: "idle" });

  useEffect(() => () => {
    active.current?.abort();
    active.current = null;
  }, []);

  async function download() {
    if (active.current) return;
    const controller = new AbortController();
    active.current = controller;
    setState({ kind: "loading" });
    try {
      const result = await requestWorkDocx(version.documentId, version.versionId, controller.signal);
      if (controller.signal.aborted) return;
      if (!result.ok) {
        setState({ kind: "error", reason: result.reason });
        return;
      }
      downloadBlob(result.blob, docxFileName(version.title));
      setState({ kind: "done", hash: result.snapshotSha256 });
    } catch {
      if (!controller.signal.aborted) setState({ kind: "error", reason: "downloadFailed" });
    } finally {
      if (active.current === controller) active.current = null;
    }
  }

  const busy = state.kind === "loading";
  return (
    <div>
      <Button busy={busy} disabled={busy} onClick={download}>{busy ? t.loading : t.button}</Button>
      <p>{t.savedVersion(formatDate.format(new Date(version.savedAt)))}</p>
      {state.kind === "done" && <p role="status">{t.fingerprint(state.hash.slice(0, 12))}</p>}
      {state.kind === "error" && <p role="alert">{t.errors[state.reason]}</p>}
    </div>
  );
}

export function DocxDownload({ version }: { version: DocxVersion }) {
  if (version && typeof version === "object") {
    return <SavedVersionDownload key={JSON.stringify([version.documentId, version.versionId])} version={version} />;
  }
  return (
    <div>
      <Button disabled>{t.button}</Button>
      {version === "loading" && <p role="status">{t.versionLoading}</p>}
      {version === "unavailable" && <p role="alert">{t.versionUnavailable}</p>}
      {version === null && <p>{t.noVersion}</p>}
    </div>
  );
}
