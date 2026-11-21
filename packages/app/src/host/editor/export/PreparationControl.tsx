"use client";

// WEB-1803: the one control both downloads use. "Pripremi" asks the server, the state is shown while it
// prepares, "Odustani" stops it, and the file is saved only when it matches the server's fingerprint.
import { useEffect, useRef, useState } from "react";
import { Button } from "@ductura/ui";

import { downloadBlob } from "../../../../../../src/components/editor/EarlierDraft";
import {
  fetchPrepared, newRequestKey, runPreparation, showsPdfA,
  type DownloadResult, type Phase, type PrepareCalls, type ReadyFile,
} from "./preparation";

export type PreparationText = {
  readonly start: string;
  readonly preparing: string;
  readonly cancel: string;
  readonly cancelled: string;
  readonly failed: string;
  readonly expired: string;
  readonly unknown: string;
  readonly retry: string;
  readonly downloading: string;
  readonly done: string;
  readonly mismatch: string;
  readonly downloadFailed: string;
  readonly retryDownload: string;
  readonly fingerprint: (prefix: string) => string;
  /** Only the PDF has these. */
  readonly pdfA?: string;
  readonly pdfAExplain?: string;
};

type After = "none" | "downloading" | "done" | "mismatch" | "downloadFailed";

export type PreparationControlProps = {
  text: PreparationText;
  /** Calls for one preparation under the given request key. */
  makeCalls: (requestKey: string) => PrepareCalls;
  download: (path: string, signal: AbortSignal) => Promise<DownloadResult>;
  downloadPrefix: string;
  fileName: string;
  onSignedOut: () => void;
  /** For tests. */
  intervalMs?: number;
};

export function PreparationControl({ text, makeCalls, download, downloadPrefix, fileName, onSignedOut, intervalMs }: PreparationControlProps) {
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [after, setAfter] = useState<After>("none");
  const active = useRef<AbortController | null>(null);
  /** The key survives an unknown outcome, so asking again is the same preparation. */
  const key = useRef<string | null>(null);
  const signOut = useRef(onSignedOut);
  signOut.current = onSignedOut;

  useEffect(() => () => { active.current?.abort(); active.current = null; }, []);

  async function save(file: ReadyFile, controller: AbortController) {
    setAfter("downloading");
    const result = await fetchPrepared(download, file, controller.signal);
    if (controller.signal.aborted) return;
    if (result.kind === "session-expired") return signOut.current();
    if (result.kind === "downloaded") {
      downloadBlob(result.blob, fileName);
      key.current = null;
      return setAfter("done");
    }
    setAfter(result.kind === "mismatch" ? "mismatch" : "downloadFailed");
  }

  async function saveAgain(file: ReadyFile) {
    if (active.current) return;
    const controller = new AbortController();
    active.current = controller;
    await save(file, controller);
    if (active.current === controller) active.current = null;
  }

  async function prepare() {
    if (active.current) return;
    const controller = new AbortController();
    active.current = controller;
    key.current ??= newRequestKey();
    setAfter("none");
    setPhase({ kind: "preparing" });
    const result = await runPreparation(makeCalls(key.current), { signal: controller.signal, downloadPrefix, intervalMs });
    if (active.current !== controller) return;
    if (result.kind === "session-expired") { active.current = null; return signOut.current(); }
    if (result.kind !== "unknown") key.current = null;
    setPhase(result);
    if (result.kind === "ready") await save(result.file, controller);
    if (active.current === controller) active.current = null;
  }

  function cancel() {
    active.current?.abort();
    active.current = null;
    key.current = null;
    setPhase({ kind: "cancelled" });
    setAfter("none");
  }

  const preparing = phase.kind === "preparing";
  const downloading = after === "downloading";
  const stuck = phase.kind === "ready" && (after === "mismatch" || after === "downloadFailed");
  return (
    <div>
      <Button busy={preparing || downloading} disabled={preparing || downloading}
        onClick={() => (stuck ? void saveAgain(phase.file) : void prepare())}>
        {preparing ? text.preparing : downloading ? text.downloading : stuck ? text.retryDownload : phase.kind === "idle" || phase.kind === "ready" ? text.start : text.retry}
      </Button>
      {preparing && <Button tone="quiet" onClick={cancel}>{text.cancel}</Button>}
      {preparing && <p role="status">{text.preparing}</p>}
      {phase.kind === "cancelled" && <p role="status">{text.cancelled}</p>}
      {phase.kind === "failed" && <p role="alert">{text.failed}</p>}
      {phase.kind === "expired" && <p role="alert">{text.expired}</p>}
      {phase.kind === "unknown" && <p role="alert">{text.unknown}</p>}
      {after === "mismatch" && <p role="alert">{text.mismatch}</p>}
      {after === "downloadFailed" && <p role="alert">{text.downloadFailed}</p>}
      {phase.kind === "ready" && after === "done" && <>
        <p role="status">{text.done}</p>
        <p>{text.fingerprint(phase.file.sha256.slice(0, 12))}</p>
      </>}
      {showsPdfA(phase) && text.pdfA !== undefined && after === "done" && <p><strong>{text.pdfA}</strong> {text.pdfAExplain}</p>}
    </div>
  );
}
