import { browserTransport, createApi, type ApiOptions } from "@/client/api";
import { summaryAgrees } from "@/client/process-summary";
import { listRevisionRequests } from "@/client/revision-requests";
import { revisionLog, type LogEntry } from "@/components/editor/revision/revision-log";

import type { FastPathLoad, FastPathStudent } from "../fast-path";

type Read =
  | { kind: "ok"; students: FastPathStudent[] }
  | { kind: "signedOut" | "forbidden" | "unavailable" };

export async function readFastPath(assignmentId: string, options: ApiOptions = {}): Promise<Read> {
  try {
    const result = await createApi({ fetchImpl: browserTransport, ...options })("teacher.fast-path.post", {
      params: undefined, query: undefined, body: { assignmentId },
    });
    if (result.status === 401) return { kind: "signedOut" };
    if (result.status === 403) return { kind: "forbidden" };
    if (result.ok && result.status === 200 && result.body.students.every((s) => !s.record || summaryAgrees(s.record.summary))) {
      return { kind: "ok", students: result.body.students };
    }
  } catch {
    // A transport error is handled like an unavailable response.
  }
  return { kind: "unavailable" };
}

export type RevisionRead =
  | { kind: "ok"; awaiting: boolean; entries: LogEntry[] }
  | { kind: "signedOut" | "forbidden" | "unavailable" };

export async function readRevisionPreview(documentId: string, current: () => boolean, options: ApiOptions = {}): Promise<RevisionRead> {
  const result = await listRevisionRequests(documentId, current, { fetchImpl: browserTransport, ...options });
  if (result.kind !== "ok") return result;
  const awaiting = result.requests.some((request) => request.state === "responded"
    && request.versions.at(-1)?.response?.kind === "done");
  return { kind: "ok", awaiting, entries: revisionLog(result.requests) };
}

export const FAST_PATH_REFRESH_MS = 5 * 60_000;

/** Wait for a visible tab and keep at least one P-03 window between starts. */
export function startFastPathReader({ assignmentId, current, onChange, read = readFastPath, visibility = document }: {
  assignmentId: string;
  current: () => boolean;
  onChange: (load: FastPathLoad) => void;
  read?: typeof readFastPath;
  visibility?: Pick<Document, "visibilityState" | "addEventListener" | "removeEventListener">;
}): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let stopped = false;
  let reading = false;
  let nextStart = 0;
  let load: FastPathLoad = { state: "loading" };

  function schedule() {
    clearTimeout(timer);
    if (!stopped && !reading && visibility.visibilityState === "visible") {
      timer = setTimeout(() => void tick(), Math.max(0, nextStart - Date.now()));
    }
  }

  async function tick() {
    if (stopped || visibility.visibilityState !== "visible" || !current()) return;
    reading = true;
    nextStart = Date.now() + FAST_PATH_REFRESH_MS;
    const result = await read(assignmentId);
    reading = false;
    if (stopped || !current()) return;
    if (result.kind === "signedOut") {
      stop();
      onChange({ state: "signedOut" });
      return;
    }
    if (result.kind === "ok") load = { state: "ready", students: result.students, stale: false };
    else if (result.kind === "unavailable" && load.state === "ready") load = { ...load, stale: true };
    else load = { state: "unavailable" };
    onChange(load);
    schedule();
  }

  function stop() {
    stopped = true;
    clearTimeout(timer);
    visibility.removeEventListener("visibilitychange", schedule);
  }

  visibility.addEventListener("visibilitychange", schedule);
  schedule();
  return stop;
}
