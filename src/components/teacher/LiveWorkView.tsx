"use client";

/**
 * N-06, the teacher's live view of one work, read-only (WEB-34 3/3; DAN-86,
 * D-142). The text is the last state the student published, read through one
 * `startLiveReader` (live.document.get) and drawn only by `LiveText`, which
 * the student's "Kako vidi nastavnik" view shares (PRODUCT §5 rule 5). The
 * summary is read once through `useProcessSummary` (every read is logged,
 * rule 17) and drawn by `SummaryCardBody`; its `recordState` also drives the
 * gap bar of `LiveWorkFrame` (C-18), so the page reads the summary once.
 *
 * Nothing here writes to the work (D-34): no comment panel and no "Zatraži
 * doradu" (wave 8). The session mark (D-118) comes from `sessionTag` of the
 * session route; once that session ends in this browser the text is dropped.
 * Until it is read the view shows the loading line, never a text.
 */

import { useEffect, useState } from "react";

import { browserTransport, SESSION_PATH } from "@/client/api";
import type { SessionMark } from "@/client/session-marks";
import { sessionTagOf } from "@/components/editor/EditorPage.scope";
import { messagesHr } from "@/lib/i18n/messages.hr";

import LiveText, { liveStopped, useLiveView } from "./LiveText";
import LiveWorkFrame, { type LiveWorkFrameData } from "./LiveWorkFrame";
import RecordLimits from "./RecordLimits";
import { SummaryCardBody, useProcessSummary } from "./SummaryCard";

const t = messagesHr.liveView;

/** The mark of this page's sign-in: a valid `sessionTag` of a 200, else null. Never throws. */
export async function readSessionMark(
  transport: typeof browserTransport = browserTransport,
  baseUrl: string = globalThis.location.origin,
  now: () => number = Date.now,
): Promise<SessionMark | null> {
  try {
    const res = await transport(new URL(SESSION_PATH, baseUrl), {
      method: "GET", credentials: "include", redirect: "manual", headers: { accept: "application/json" },
    });
    if (res.status !== 200 || !res.headers.get("content-type")?.startsWith("application/json")) return null;
    const tag = sessionTagOf(await res.json());
    return tag === null ? null : { tag, at: now() };
  } catch {
    return null;
  }
}

function LiveBody({ documentId, session, frame }: {
  documentId: string; session: SessionMark | null; frame: LiveWorkFrameData | null;
}) {
  const { view, current } = useLiveView(documentId, session);
  const stopped = liveStopped(view);
  const summary = useProcessSummary(documentId, current, !stopped);
  const recordState = summary.outcome?.kind === "ok" ? summary.outcome.summary.recordState : null;
  return (
    <LiveWorkFrame
      documentId={documentId}
      frame={stopped ? null : frame}
      recordState={recordState}
      text={<LiveText view={view} marks={[]} />}
      aside={
        <>
          {stopped ? null : <SummaryCardBody outcome={summary.outcome} onReload={() => void summary.load()} />}
          <RecordLimits />
        </>
      }
    />
  );
}

export default function LiveWorkView({ documentId, frame }: {
  documentId: string;
  /** TODO(ugovor) teacher.work.get: null until the route is in the contract. */
  frame: LiveWorkFrameData | null;
}) {
  // undefined while the session route is read; the live reader starts only after.
  const [session, setSession] = useState<SessionMark | null | undefined>(undefined);
  useEffect(() => {
    let live = true;
    void readSessionMark().then((mark) => { if (live) setSession(mark); });
    return () => { live = false; };
  }, []);
  if (session === undefined) {
    return (
      <LiveWorkFrame
        documentId={documentId}
        frame={null}
        recordState={null}
        text={<p role="status" className="manuscript__placeholder">{t.loading}</p>}
        aside={<RecordLimits />}
      />
    );
  }
  return <LiveBody documentId={documentId} session={session} frame={frame} />;
}
