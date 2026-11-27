"use client";

import { Button, Card, DataTable, Fingerprint, type DataTableColumn } from "@ductura/ui";
import { useEffect, useRef, useState } from "react";

// Relative paths, like DeadlineExtensions: packages/app imports src/components without the "@/" alias.
import { createApi, goToSignIn, leaveFor } from "../../../client/api.ts";
import {
  hasSubmissions, merlinCsvPath, newRequestKey, packageView, readMerlinPackage, requestMerlinPackage,
  type MerlinExtensionReason, type MerlinPackage, type MerlinRow, type PackageView,
} from "../../../client/merlin-export.ts";
import { formatDateTimeHr } from "../../../lib/i18n/hr.ts";
import { messagesHr } from "../../../lib/i18n/messages.hr.ts";
import LoadAlert from "../../shell/LoadAlert.tsx";

import { merlinHref } from "./links.ts";
import styles from "./MerlinExport.module.css";

const t = messagesHr.merlinExport;
const reasonsT = messagesHr.deadlineExtensions.reasons;
/** How often a queued package is read again. */
export const POLL_MS = 3000;

/** The roster as the page read it; anything but rows is "unavailable", never "none". */
export type RosterRead =
  | { kind: "ready"; rows: readonly MerlinRow[]; extensionReasons: readonly MerlinExtensionReason[] }
  | { kind: "unavailable" };

/** What the status area says, from the package and the last request. */
export type ExportStatus =
  | { kind: "none" }
  | { kind: "pending" }
  | { kind: "view"; view: PackageView }
  | { kind: "notFound" }
  | { kind: "unknown" };

function fill(text: string, values: Readonly<Record<string, string>>): string {
  return text.replace(/\{(\w+)\}/g, (_, name: string) => values[name] ?? "");
}

function yesNo(value: boolean | null): string {
  return value === null ? t.none : value ? t.yes : t.no;
}

/**
 * The preview columns, in the order of the CSV (D-286); null cells read as "nema", a missing name in words.
 * Design alignment 27. 11. 2026. (A5): the file fingerprints stay in the CSV and the package, not on screen.
 */
export function rosterColumns(): DataTableColumn<MerlinRow>[] {
  const mono = (value: string | null) => (value === null ? t.none : <span className={styles.mono}>{value}</span>);
  return [
    { id: "familyName", header: t.columns.familyName, rowHeader: true, cell: (r) => r.familyName ?? t.unnamed },
    { id: "givenName", header: t.columns.givenName, cell: (r) => r.givenName ?? t.unnamed },
    { id: "submitted", header: t.columns.submitted, cell: (r) => yesNo(r.submitted) },
    { id: "submittedMinute", header: t.columns.submittedMinute, cell: (r) => (r.submittedMinute === null ? t.none : formatDateTimeHr(r.submittedMinute)) },
    { id: "afterDeadline", header: t.columns.afterDeadline, cell: (r) => yesNo(r.afterDeadline) },
    { id: "pdfName", header: t.columns.pdfName, cell: (r) => mono(r.pdfName) },
    { id: "docxName", header: t.columns.docxName, cell: (r) => mono(r.docxName) },
  ];
}

/** One line per extension reason of the caller's own (N-13), oldest first as the server sent them. */
export function reasonLines(reasons: readonly MerlinExtensionReason[]): string[] {
  return reasons.map((r) => fill(t.reasonLine, {
    due: formatDateTimeHr(r.dueAt),
    reason: reasonsT[r.reasonId],
    scope: r.studentId === null ? t.reasonAll : t.reasonOne,
  }));
}

/** The status text lines (and tone) for a status; the ready view adds its fingerprint and button. */
export function statusLines(status: ExportStatus): { tone: "status" | "alert"; lines: string[] } | null {
  switch (status.kind) {
    case "none":
      return null;
    case "pending":
      return { tone: "status", lines: [t.preparing] };
    case "notFound":
      return { tone: "alert", lines: [t.notFound] };
    case "unknown":
      return { tone: "alert", lines: [t.unknown] };
    case "view": {
      const v = status.view;
      if (v.kind === "priprema") return { tone: "status", lines: [t.preparing] };
      if (v.kind === "neuspjeh") return { tone: "alert", lines: [t.failed] };
      if (v.kind === "istekao") return { tone: "alert", lines: [fill(t.expired, { expires: formatDateTimeHr(v.expiresAt) })] };
      return { tone: "status", lines: [t.readyTitle, fill(t.ready, { expires: formatDateTimeHr(v.expiresAt) })] };
    }
  }
}

/** The package may be downloaded only from a ready view (C-16). */
export function canDownload(status: ExportStatus): status is { kind: "view"; view: Extract<PackageView, { kind: "spreman" }> } {
  return status.kind === "view" && status.view.kind === "spreman";
}

/**
 * WEB-1114 (N-18, C-16): the roster preview in the order of the CSV, the
 * separate CSV download, and the package: prepared under a request key,
 * shown while it is being prepared, downloadable only while ready and before
 * its expiry, with the server's fingerprint of the ZIP to copy as it is.
 */
export default function MerlinExport({
  assignmentId, roster, returnTo, now = () => Date.now(),
}: {
  assignmentId: string;
  roster: RosterRead;
  /** Where sign-in returns after an ended session; by default the page of N-18 without a base. */
  returnTo?: string;
  /** The clock, for tests. */
  now?: () => number;
}) {
  const [status, setStatus] = useState<ExportStatus>({ kind: "none" });
  const [pkg, setPkg] = useState<MerlinPackage | null>(null);
  const [busy, setBusy] = useState(false);
  // The key of an attempt whose outcome is unknown: the next attempt sends it again.
  const pendingKey = useRef<string | null>(null);
  const back = returnTo ?? merlinHref(assignmentId);
  const client = () => createApi();

  async function refresh(packageId: string): Promise<void> {
    const read = await readMerlinPackage(client(), assignmentId, packageId);
    if (read.kind === "session-expired") return goToSignIn(back);
    if (read.kind === "greska") return setStatus(read.code === "not_found" ? { kind: "notFound" } : { kind: "unknown" });
    if (read.kind === "nepoznato") return setStatus({ kind: "unknown" });
    setPkg(read.pkg);
    setStatus({ kind: "view", view: packageView(read.pkg, now()) });
  }

  // A queued package is read again until it is no longer queued.
  useEffect(() => {
    if (pkg === null || pkg.state !== "queued") return;
    const timer = setTimeout(() => void refresh(pkg.id), POLL_MS);
    return () => clearTimeout(timer);
  }, [pkg]);

  // A ready package turns expired on screen when its expiry passes.
  useEffect(() => {
    if (pkg === null || pkg.state !== "ready") return;
    const left = Date.parse(pkg.expiresAt) - now();
    if (!(left > 0)) return;
    const timer = setTimeout(() => setStatus({ kind: "view", view: packageView(pkg, now()) }), Math.min(left, 2 ** 31 - 1));
    return () => clearTimeout(timer);
  }, [pkg]);

  async function prepare() {
    if (busy) return;
    setBusy(true);
    setStatus({ kind: "pending" });
    const key = pendingKey.current ?? newRequestKey();
    pendingKey.current = key;
    const answer = await requestMerlinPackage(client(), assignmentId, key);
    if (answer.kind !== "nepoznato") pendingKey.current = null;
    if (answer.kind === "session-expired") {
      setBusy(false);
      return goToSignIn(back);
    }
    if (answer.kind === "zatrazeno") await refresh(answer.id);
    else setStatus(answer.kind === "greska" && answer.code === "not_found" ? { kind: "notFound" } : { kind: "unknown" });
    setBusy(false);
  }

  async function download() {
    if (pkg === null || busy) return;
    setBusy(true);
    // The state is read again first: only a package still ready before its expiry is downloaded.
    const read = await readMerlinPackage(client(), assignmentId, pkg.id);
    setBusy(false);
    if (read.kind === "session-expired") return goToSignIn(back);
    if (read.kind !== "paket") return setStatus(read.kind === "greska" && read.code === "not_found" ? { kind: "notFound" } : { kind: "unknown" });
    const view = packageView(read.pkg, now());
    setPkg(read.pkg);
    setStatus({ kind: "view", view });
    if (view.kind === "spreman") leaveFor(view.downloadPath);
  }

  if (roster.kind === "unavailable") {
    // Design alignment 27. 11. 2026. (A2, D3): the alert box, with the way to try again under it.
    return (
      <Card title={t.rosterTitle}>
        <LoadAlert retry={{ label: t.retry, href: back }}>{t.unavailable}</LoadAlert>
      </Card>
    );
  }

  const submitted = hasSubmissions(roster.rows);
  const position = new Map(roster.rows.map((row, i) => [row, i] as const));
  const said = statusLines(status);
  const preparing = busy || (status.kind === "view" && status.view.kind === "priprema") || status.kind === "pending";
  // Once a package exists (ready, expired or failed), preparing again makes a new one under a new key.
  const ended = status.kind === "view" && status.view.kind !== "priprema";

  return (
    <>
      {submitted ? null : (
        <Card title={t.noSubmissionsTitle}>
          <p>{t.noSubmissions}</p>
        </Card>
      )}
      {said !== null ? (
        <div role={said.tone} className={said.tone === "alert" ? styles.alert : styles.banner} aria-live="polite">
          {said.lines.map((line, i) => (i === 0 && canDownload(status) ? <p key={line}><b>{line}</b></p> : <p key={line}>{line}</p>))}
          {canDownload(status) ? (
            <div className={styles.fingerprint}>
              <span className={styles.label}>{t.packageFingerprint}</span>
              {/* Design alignment 27. 11. 2026. (A5): no digest for people; the copy button stays. */}
              <Fingerprint value={status.view.sha256} showDigest={false} />
              <p className={styles.meta}>{t.packageFingerprintNote}</p>
              <div className={styles.actions}>
                <Button onClick={download} busy={busy}>{t.download}</Button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
      <Card title={t.rosterTitle}>
        <DataTable
          caption={t.rosterCaption}
          columns={rosterColumns()}
          rows={roster.rows}
          rowKey={(r) => String(position.get(r))}
          empty={t.empty}
        />
        <p className={styles.meta}>{t.rosterNote}</p>
      </Card>
      <Card title={t.fingerprintsTitle}>
        <p>{t.fingerprintsNote}</p>
        <p>{t.fingerprintsMeaning}</p>
        <p className={styles.meta}>{t.trail}</p>
      </Card>
      {roster.extensionReasons.length > 0 ? (
        <Card title={t.reasonsTitle}>
          <ul className={styles.reasons}>
            {reasonLines(roster.extensionReasons).map((line, i) => <li key={i}>{line}</li>)}
          </ul>
          <p className={styles.meta}>{t.reasonsNote}</p>
        </Card>
      ) : null}
      <div className={styles.actions}>
        {submitted ? (
          <Button onClick={prepare} busy={preparing}>{ended ? t.prepareAgain : t.prepare}</Button>
        ) : null}
        <Button tone="quiet" onClick={() => leaveFor(merlinCsvPath(assignmentId))}>{t.csv}</Button>
      </div>
    </>
  );
}
