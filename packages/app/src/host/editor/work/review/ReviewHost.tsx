"use client";

// WEB-2121 (parity E§2.5 review2, mentor2/3): the Pregled card, the round notice,
// "Pošalji doradu", "Vrati na doradu" and the version comparison of the work
// page, composed from the built components. Reads only through src/client.
import { Button, Dialog } from "@ductura/ui";
import { useEffect, useState, type ComponentProps } from "react";

import { createApi } from "../../../../../../../src/client/api.ts";
import { fetchTextCheckConfig } from "../../../../../../../src/client/text-check-config.ts";
import { listRevisionRequests } from "../../../../../../../src/client/revision-requests.ts";
import { ReviewPanel } from "../../../../../../../src/components/editor/review/ReviewPanel.tsx";
import SendRevisionDialog from "../../../../../../../src/components/editor/revision/SendRevisionDialog.tsx";
import ReturnForRevisionDialog from "../../../../../../../src/components/teacher/revision/ReturnForRevisionDialog.tsx";
import { VersionComparison } from "../../../../../../../src/components/editor/diff/VersionComparison.tsx";
import { readSubmittedVersions, type ComparisonApi } from "../../../../../../../src/components/editor/diff/comparison-read.ts";

import { LIVE_PORT, compareOptions, roundNotice, roundOf, type RevisionPort, type RoundView } from "./review-model";
import styles from "./Review.module.css";
import { reviewHostHr as t } from "./messages.hr";

type Editor = ComponentProps<typeof ReviewPanel>["editor"];

/** The Pregled card: the checks the institution enabled for this assignment, or none read. */
export function ReviewCardHost({ editor, assignmentId, documentId }: { editor: Editor | null; assignmentId: string; documentId: string }) {
  const [ids, setIds] = useState<readonly string[] | null | undefined>(undefined);
  useEffect(() => {
    let live = true;
    void fetchTextCheckConfig(assignmentId).then((outcome) => {
      if (live) setIds(outcome.kind === "ok" ? outcome.config.enabledCheckIds : null);
    }).catch(() => { if (live) setIds(null); });
    return () => { live = false; };
  }, [assignmentId]);
  return <ReviewPanel editor={editor} documentId={documentId} enabledCheckIds={ids ?? null} loading={ids === undefined} />;
}

/** One read of the revision requests: the round and who is to act. */
export function useRound(documentId: string): RoundView {
  const [view, setView] = useState<RoundView>({ kind: "none" });
  useEffect(() => {
    let live = true;
    void listRevisionRequests(documentId).then((outcome) => {
      if (live) setView(outcome.kind === "ok" ? roundOf(outcome.requests) : { kind: "none" });
    });
    return () => { live = false; };
  }, [documentId]);
  return view;
}

function Compare({ documentId }: { documentId: string }) {
  const [state, setState] = useState<"loading" | "none" | "error" | "ready">("loading");
  const [attempt, setAttempt] = useState(0);
  const client = createApi() as unknown as ComparisonApi;
  useEffect(() => {
    let live = true;
    setState("loading");
    void readSubmittedVersions(client, documentId).then((read) => {
      if (!live) return;
      if (read.kind !== "ready") return setState("error");
      setState(compareOptions(read.value).length < 2 ? "none" : "ready");
    });
    return () => { live = false; };
    // `client` is a fresh closure each render; the attempt asks again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentId, attempt]);
  if (state === "loading") return <p role="status" className={styles.status}>…</p>;
  if (state === "none") return <p role="status" className={styles.status}>{t.compareNone}</p>;
  if (state === "error") {
    return <div><p role="alert" className={styles.alert}>{t.compareUnavailable}</p><Button tone="secondary" size="dense" onClick={() => setAttempt((n) => n + 1)}>{t.retry}</Button></div>;
  }
  return <VersionComparison client={client} documentId={documentId} replayHref="" />;
}

/**
 * The actions of the Mentor card: the notice and "Pregled runde" for the teacher,
 * "Pošalji doradu" for the student, "Vrati na doradu" for the teacher, and the
 * comparison. An action the port does not carry says it is unavailable.
 */
export function RevisionActionsHost({ documentId, role, today, port = LIVE_PORT }: {
  documentId: string; role: "student" | "teacher"; today: string; port?: RevisionPort;
}) {
  const view = useRound(documentId);
  const [dialog, setDialog] = useState<"send" | "return" | "compare" | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const notice = roundNotice(view, role, t.roundNotice);
  const close = () => setDialog(null);
  const unavailable = (text: string) => <p role="status" className={styles.status}>{text}</p>;
  return (
    <section className={styles.card} aria-label={t.cardTitle}>
      {notice && <p role="status" className={styles.notice}>{notice} <Button tone="ghost" size="dense" onClick={() => setDialog("compare")}>{t.roundOpen}</Button></p>}
      <div className={styles.row}>
        {role === "student" && (port.send
          ? <Button size="dense" onClick={() => setDialog("send")}>{t.send}</Button> : unavailable(t.sendUnavailable))}
        {role === "teacher" && (port.returnForRevision
          ? <Button size="dense" onClick={() => setDialog("return")}>{t.returnOpen}</Button> : unavailable(t.returnUnavailable))}
        <Button tone="secondary" size="dense" onClick={() => setDialog("compare")}>{t.compareOpen}</Button>
      </div>
      {done && <p role="status" className={styles.status}>{done}</p>}
      {port.send && <SendRevisionDialog documentId={documentId} open={dialog === "send"} onClose={close}
        summary={{ textChanged: true, resolved: 0, stillOpen: view.kind === "student-turn" ? view.open : 0 }}
        post={port.send} onSent={() => { close(); setDone(t.sent); }} />}
      {port.returnForRevision && <ReturnForRevisionDialog documentId={documentId} today={today} open={dialog === "return"} onClose={close}
        post={port.returnForRevision} onSent={() => { close(); setDone(t.returned); }} />}
      <Dialog open={dialog === "compare"} title={t.compareTitle} onClose={close}
        actions={<Button tone="quiet" onClick={close}>{t.close}</Button>}>
        {dialog === "compare" && <Compare documentId={documentId} />}
      </Dialog>
    </section>
  );
}
