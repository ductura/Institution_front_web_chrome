"use client";

/**
 * The editor mounted on `/rad/<assignmentId>` (WEB-14b) for a work already
 * started. First the person's journal scope is read from the session route (WEB-14c,
 * fail closed: without a valid `journalScope` and `sessionTag` nothing is
 * opened). The session mark goes to SessionObserver and the provider, so a
 * sign-out or another sign-in elsewhere stops this sheet. Then the
 * work is opened once through src/client (`openWork`, evidence.open.post over
 * createApi); its documentId names the document in that journal. Then
 * LocalDocument owns the editor, the journal, the Web Lock (one writer per
 * document, A-12) and the EvidenceSession that sends the text and verifies
 * each receipt. The toolbar (WEB-15) and the status bar read that provider.
 * Nothing here sends text by itself.
 */

import { useEffect, useState, type ComponentProps, type ReactNode } from "react";

import { signInHref } from "@/client/api";
import { openWork, type OpenOutcome } from "@/client/evidence-ingest";
import type { SessionMark } from "@/client/session-marks";
import SessionObserver from "@/components/shell/SessionObserver";
import { messagesHr as t } from "@/lib/i18n/messages.hr";

import EditorPage, { SheetNote } from "./EditorPage";
import { readJournalScope, type ScopeRead } from "./EditorPage.scope";
import EditorToolbar from "./EditorToolbar";
import { LocalDocumentProvider, LocalEditor } from "./LocalDocument";
import RevisionPanel from "./RevisionPanel";
import { EditorPanelLayout } from "./SidePanels";
import StatusBar from "./StatusBar";
import StatusBarLive from "./StatusBarLive";

export type OpenRead =
  | { readonly kind: "opening" }
  | { readonly kind: "ready"; readonly documentId: string; readonly scope: string; readonly session: SessionMark }
  | { readonly kind: "signedOut" }
  | { readonly kind: "closed" }
  | { readonly kind: "reload" }
  | { readonly kind: "unavailable" };

/** What the page does with one answer of the open route, under the person's journal scope and session. */
export function openReadOf(outcome: OpenOutcome, scope: string, session: SessionMark): OpenRead {
  switch (outcome.status) {
    case "opened":
      return { kind: "ready", documentId: outcome.work.documentId, scope, session };
    case "unauthenticated":
      return { kind: "signedOut" };
    case "not_found":
    case "not_accepting":
      return { kind: "closed" };
    case "upgrade_required":
      return { kind: "reload" };
    default:
      return { kind: "unavailable" };
  }
}

export type WorkReaders = {
  readonly readScope: () => Promise<ScopeRead>;
  readonly open: (assignmentId: string) => Promise<OpenOutcome>;
};

const LIVE_READERS: WorkReaders = { readScope: () => readJournalScope(), open: (id) => openWork(id) };

/**
 * The scope first, then the work: no valid scope (WEB-14c) opens nothing, not
 * even the evidence session, and the page shows that the work cannot be opened.
 */
export async function readWork(assignmentId: string, readers: WorkReaders = LIVE_READERS): Promise<OpenRead> {
  const scope = await readers.readScope().catch((): ScopeRead => ({ kind: "unavailable" }));
  if (scope.kind === "signedOut") return { kind: "signedOut" };
  if (scope.kind !== "scope") return { kind: "unavailable" };
  const outcome = await readers.open(assignmentId).catch((): OpenOutcome => ({ status: "unavailable" }));
  return openReadOf(outcome, scope.scope, scope.session);
}

function Note({ read, here }: { read: Exclude<OpenRead, { kind: "ready" }>; here: string }) {
  if (read.kind === "opening") return <SheetNote>{t.workspace.openLoading}</SheetNote>;
  if (read.kind === "signedOut") {
    return (
      <SheetNote>
        {t.auth.signedOutElsewhere} <a href={signInHref(here)}>{t.auth.signInAgain}</a>
      </SheetNote>
    );
  }
  if (read.kind === "reload") return <SheetNote>{t.workspace.openReload}</SheetNote>;
  if (read.kind === "closed") return <SheetNote>{t.workspace.openNotAccepting}</SheetNote>;
  return <SheetNote>{t.workspace.openError}</SheetNote>;
}

export default function EditorPageWork({
  assignmentId,
  course,
  title,
  topBar,
  length,
}: {
  assignmentId: string;
  course: string;
  title: string;
  topBar?: ReactNode;
  length?: ComponentProps<typeof StatusBar>["length"];
}) {
  const [read, setRead] = useState<OpenRead>({ kind: "opening" });
  useEffect(() => {
    let live = true;
    void readWork(assignmentId)
      .catch((): OpenRead => ({ kind: "unavailable" }))
      .then((next) => { if (live) setRead(next); });
    return () => { live = false; };
  }, [assignmentId]);

  if (read.kind !== "ready") {
    return (
      <EditorPage course={course} title={title} topBar={topBar} status={<StatusBar save={null} length={length} />}>
        <Note read={read} here={`/rad/${assignmentId}`} />
      </EditorPage>
    );
  }
  return (
    <>
      <SessionObserver tag={read.session.tag} at={read.session.at} />
      <LocalDocumentProvider key={`${read.session.tag}:${read.scope}:${read.documentId}`} scope={read.scope} documentId={read.documentId} assignmentId={assignmentId} session={read.session}>
        <EditorPanelLayout
          title={title}
          header={topBar ?? <p>{course} / {title}</p>}
          tools={<EditorToolbar />}
          status={<StatusBarLive evidence length={length} />}
          rightSections={{
            work: <RevisionPanel documentId={read.documentId} assignmentId={assignmentId} session={read.session} />,
          }}
        >
          <LocalEditor />
        </EditorPanelLayout>
      </LocalDocumentProvider>
    </>
  );
}
