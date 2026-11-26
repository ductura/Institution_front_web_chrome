"use client";

// VIZ-S3 (S: E-7): the pieces of the workspace frame that are not the editor:
// the notes of the prototype's `.ed-banner`, the loading card `.ed-load` and the
// footer for the variants without an editor. Texts are in messages.hr.ts.
import { Button, Skeleton } from "@ductura/ui";
import { useEffect, useState, type ReactNode } from "react";

import { useOnline } from "../../../../../../src/client/online-status.ts";
import statusStyles from "../../../../../../src/components/editor/StatusBar.module.css";
import { scopeLine, type ScopeRange } from "../../../../../../src/components/editor/StatusBar.tsx";
import { messagesHr as t } from "../../../../../../src/lib/i18n/messages.hr.ts";
import { openFailureExit, openFailureText } from "../../../../../../src/components/editor/open-failure.ts";

import { createApi } from "../../../../../../src/client/api.ts";
import { appHref } from "../../../../../../src/components/shell/nav.ts";
import { readWithdrawalState, type StateRead, type WithdrawCall } from "../submission/withdraw/contract";
import { WITHDRAW_HASH } from "../submission/withdraw/model";
import { workText } from "./messages.hr";
import styles from "./frame.module.css";

/** "8. 11. 2026., 23:59" in the faculty's time zone, as the prototype writes a moment. */
export function momentHr(iso: string): string | null {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return null;
  const part = (type: string, options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat("hr-HR", { timeZone: "Europe/Zagreb", ...options }).formatToParts(at).find((p) => p.type === type)?.value ?? "";
  const day = part("day", { day: "numeric" });
  const month = part("month", { month: "numeric" });
  const year = part("year", { year: "numeric" });
  const hour = part("hour", { hour: "2-digit", hourCycle: "h23" });
  const minute = part("minute", { minute: "2-digit" });
  return `${day}. ${month}. ${year}., ${hour}:${minute}`;
}

/** The line under the title: "Kolegij A · rok 8. 11. 2026., 23:59". */
export function courseLine(course: string, dueAt: string): string {
  const due = momentHr(dueAt);
  return due === null ? course : workText.courseLine.replace("{course}", course).replace("{due}", due);
}

export function Banner({ lead, children }: { lead?: string; children: ReactNode }) {
  return (
    <div className={styles.banner} role="status">
      <p>{lead ? <b>{lead} </b> : null}{children}</p>
    </div>
  );
}

/** The withdrawal's state of one work; the server's (student.submission-withdrawal.get) by default. */
export type WithdrawalRead = (assignmentId: string) => Promise<StateRead>;
const serverWithdrawal: WithdrawalRead = (assignmentId) => readWithdrawalState(createApi() as unknown as WithdrawCall, assignmentId);

/**
 * E-7a (NF-3 PR-1, G-21): the banner of a submitted work with its ways on. "Otvori potvrdu o predaji"
 * always; "Povuci predaju" only while the server says the submission can be withdrawn (the same read as
 * the receipt's E-11b), and it leads to the receipt, where the confirmation of the withdrawal opens.
 * The client never compares a time with a deadline.
 */
export function SubmittedBanner({ assignmentId, base, lead, read = serverWithdrawal }: {
  assignmentId: string; base: string; lead?: string; read?: WithdrawalRead;
}) {
  const [withdrawable, setWithdrawable] = useState(false);
  useEffect(() => {
    let live = true;
    void read(assignmentId).then(
      (state) => { if (live) setWithdrawable(state.kind === "ready" && state.state.withdrawable); },
      () => undefined,
    );
    return () => { live = false; };
  }, [assignmentId, read]);
  const receipt = appHref(base, `/rad/${encodeURIComponent(assignmentId)}/predaja/potvrda`);
  return (
    <div className={styles.banner} role="status">
      <p>{lead ? <b>{lead} </b> : null}{workText.submittedBody}</p>
      <div className={styles.actions}>
        <a href={receipt}>{workText.openReceipt}</a>
        {withdrawable ? <a href={`${receipt}#${WITHDRAW_HASH}`}>{workText.withdraw}</a> : null}
      </div>
    </div>
  );
}

/** E-7 `bez-mreze`: shown only while the browser reports no network. */
export function OfflineBanner() {
  const online = useOnline();
  return online ? null : <Banner lead={workText.offlineLead}>{workText.offlineBody}</Banner>;
}

/** E-7 `ucitavanje`: the card of grey bars. */
export function LoadingCard() {
  return (
    <div className={styles.load} aria-busy="true">
      <Skeleton label={workText.loading} lines={4} />
    </div>
  );
}

/**
 * E-7 `greska`: the cause in `role="alert"` and its way out (ED-01b). The frame
 * reads no work yet, so its causes are the network and the server; the sheet
 * of the editor says the same sentence for the same cause.
 */
export function ErrorCard({ failure = "server", onRetry }: { failure?: "offline" | "server"; onRetry: () => void }) {
  const exit = openFailureExit(failure, { assignmentId: "" });
  return (
    <div className={styles.banner} role="alert" data-open-failure={failure}>
      <p>{openFailureText(failure)}</p>
      <div><Button tone="secondary" size="small" onClick={onRetry}>{exit.label}</Button></div>
    </div>
  );
}

/** The footer for the variants without an editor: one chip, the length and, offline, "Bez mreže". */
export function FrameStatus({ chip, note, length, withNet = false }: {
  chip: ReactNode;
  /** Plain words after the chip (a submitted work: "Samo za čitanje"). */
  note?: string;
  length?: { words: number | null; range: ScopeRange };
  withNet?: boolean;
}) {
  const online = useOnline();
  const scope = length === undefined ? null : scopeLine(length.words, length.range);
  return (
    <footer className={statusStyles.bar} aria-label={t.workspace.status}>
      {chip}
      {note === undefined ? null : <span className={statusStyles.scope}>{note}</span>}
      {scope === null ? null : <span className={statusStyles.scope}>{scope}</span>}
      {withNet && !online ? <span className={statusStyles.net}>{workText.offlineNet}</span> : null}
    </footer>
  );
}
