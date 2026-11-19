"use client";

/**
 * The editor mounted on `/rad/<assignmentId>` (WEB-14b) for a work already
 * started. The work is opened once through src/client (`openWork`,
 * evidence.open.post over createApi); its documentId names the journal. Then
 * LocalDocument owns the editor, the journal, the Web Lock (one writer per
 * document, A-12) and the EvidenceSession that sends the text and verifies
 * each receipt. The toolbar (WEB-15) and the status bar read that provider.
 * Nothing here sends text by itself.
 */

import { useEffect, useState } from "react";

import { signInHref } from "@/client/api";
import { openWork, type OpenOutcome } from "@/client/evidence-ingest";
import { messagesHr as t } from "@/lib/i18n/messages.hr";

import EditorPage, { SheetNote } from "./EditorPage";
import { journalScopeOf } from "./EditorPage.scope";
import EditorToolbar from "./EditorToolbar";
import { LocalDocumentProvider, LocalEditor } from "./LocalDocument";
import StatusBar from "./StatusBar";
import StatusBarLive from "./StatusBarLive";

export type OpenRead =
  | { readonly kind: "opening" }
  | { readonly kind: "ready"; readonly documentId: string; readonly scope: string }
  | { readonly kind: "signedOut" }
  | { readonly kind: "closed" }
  | { readonly kind: "reload" }
  | { readonly kind: "unavailable" };

/** What the page does with one answer of the open route; the journal scope only for an opened work. */
export async function openReadOf(outcome: OpenOutcome, scopeOf: (documentId: string) => Promise<string> = journalScopeOf): Promise<OpenRead> {
  switch (outcome.status) {
    case "opened":
      return { kind: "ready", documentId: outcome.work.documentId, scope: await scopeOf(outcome.work.documentId) };
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

export default function EditorPageWork({ assignmentId, course, title }: { assignmentId: string; course: string; title: string }) {
  const [read, setRead] = useState<OpenRead>({ kind: "opening" });
  useEffect(() => {
    let live = true;
    void openWork(assignmentId)
      .catch((): OpenOutcome => ({ status: "unavailable" }))
      .then((outcome) => openReadOf(outcome))
      .catch((): OpenRead => ({ kind: "unavailable" }))
      .then((next) => { if (live) setRead(next); });
    return () => { live = false; };
  }, [assignmentId]);

  if (read.kind !== "ready") {
    return (
      <EditorPage course={course} title={title} status={<StatusBar save={null} />}>
        <Note read={read} here={`/rad/${assignmentId}`} />
      </EditorPage>
    );
  }
  return (
    <LocalDocumentProvider key={read.documentId} scope={read.scope} documentId={read.documentId} assignmentId={assignmentId}>
      <EditorPage course={course} title={title} toolbar={<EditorToolbar />} status={<StatusBarLive evidence />}>
        <LocalEditor />
      </EditorPage>
    </LocalDocumentProvider>
  );
}
