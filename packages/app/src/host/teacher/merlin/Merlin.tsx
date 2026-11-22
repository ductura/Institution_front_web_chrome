"use client";

import { useEffect, useRef, useState } from "react";
import { Button, Card, DataTable, Fingerprint, Select, type DataTableColumn } from "@ductura/ui";

import { newRequestKey, packageView } from "../../../../../../src/client/merlin-export.ts";
import { messagesHr } from "../../../../../../src/lib/i18n/messages.hr.ts";
import { merlinMessages as text } from "./messages.hr";
import {
  COLUMN_HEADERS, POLL_MS, canDownload, hasSubmitted, reasonLines, rowCells, statusLines,
  type ExportStatus, type MerlinData, type MerlinPackage, type MerlinPort,
} from "./model";

const IDS = ["familyName", "givenName", "submitted", "submittedMinute", "afterDeadline", "fileName", "pdfSha256", "docxSha256"] as const;
const COLUMNS: DataTableColumn<{ key: string; cells: string[] }>[] = IDS.map((id, i) => ({
  id, header: COLUMN_HEADERS[i] ?? id, rowHeader: i === 0, cell: (r) => r.cells[i] ?? text.none,
}));

/**
 * N-18 "Izvoz za Merlin" (WEB-2163): the CSV preview with the eight columns of the prototype, the card
 * "Otisci", the package prepared under a request key (a repeated request is the same package), a
 * downloadable package only while ready and before its expiry (C-16), the server's fingerprint as it is.
 * Read-only for a collaborator is the server's rule; this screen only asks and shows.
 */
export default function Merlin({ assignmentId, data, port, onChoose, now = () => Date.now() }: {
  assignmentId: string;
  data: MerlinData;
  port: MerlinPort;
  /** Called with another assignment's id from the "Zadatak" select. */
  onChoose?: (assignmentId: string) => void;
  now?: () => number;
}) {
  const [status, setStatus] = useState<ExportStatus>({ kind: "none" });
  const [pkg, setPkg] = useState<MerlinPackage | null>(null);
  const [busy, setBusy] = useState(false);
  const pendingKey = useRef<string | null>(null);

  async function refresh(packageId: string): Promise<void> {
    const read = await port.readPackage(assignmentId, packageId);
    if (read.kind === "session-expired") return;
    if (read.kind === "greska") return setStatus(read.code === "not_found" ? { kind: "notFound" } : { kind: "unknown" });
    if (read.kind === "nepoznato") return setStatus({ kind: "unknown" });
    setPkg(read.pkg);
    setStatus({ kind: "view", view: packageView(read.pkg, now()) });
  }

  useEffect(() => {
    if (pkg === null || pkg.state !== "queued") return;
    const timer = setTimeout(() => void refresh(pkg.id), POLL_MS);
    return () => clearTimeout(timer);
  }, [pkg]);

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
    const answer = await port.requestPackage(assignmentId, key);
    if (answer.kind !== "nepoznato") pendingKey.current = null;
    if (answer.kind === "zatrazeno") await refresh(answer.id);
    else if (answer.kind !== "session-expired") setStatus(answer.kind === "greska" && answer.code === "not_found" ? { kind: "notFound" } : { kind: "unknown" });
    setBusy(false);
  }

  async function download() {
    if (pkg === null || busy) return;
    setBusy(true);
    const read = await port.readPackage(assignmentId, pkg.id);
    setBusy(false);
    if (read.kind === "session-expired") return;
    if (read.kind !== "paket") return setStatus(read.kind === "greska" && read.code === "not_found" ? { kind: "notFound" } : { kind: "unknown" });
    const view = packageView(read.pkg, now());
    setPkg(read.pkg);
    setStatus({ kind: "view", view });
    if (view.kind === "spreman") port.leaveFor(view.downloadPath);
  }

  const submitted = hasSubmitted(data.rows);
  const said = statusLines(status);
  const preparing = busy || status.kind === "pending" || (status.kind === "view" && status.view.kind === "priprema");
  const ended = status.kind === "view" && status.view.kind !== "priprema";
  const rows = data.rows.map((row, i) => ({ key: String(i), cells: rowCells(row) }));
  const options = data.assignments === null ? [] : data.assignments.map((a) => ({ value: a.id, label: a.title ?? text.taskUnnamed }));

  return (
    <>
      {options.length > 1 ? (
        <div style={{ maxWidth: 420 }}>
          <Select label={text.taskLabel} options={options} value={assignmentId} onChange={(event) => onChoose?.(event.target.value)} />
        </div>
      ) : null}
      {submitted ? null : (
        <Card title={text.emptyTitle}><p>{text.emptyBody}</p></Card>
      )}
      {said !== null ? (
        <div role={said.tone} aria-live="polite" data-testid="merlin-status">
          {said.lines.map((line, i) => (i === 0 && canDownload(status) ? <p key={line}><b>{line}</b></p> : <p key={line}>{line}</p>))}
          {canDownload(status) ? (
            <div>
              <strong>{text.packageFingerprint}</strong>
              <Fingerprint value={status.view.sha256} />
              <p>{text.packageFingerprintNote}</p>
              <Button onClick={download} busy={busy}>{text.download}</Button>
            </div>
          ) : null}
        </div>
      ) : null}
      <Card title={text.rosterTitle}>
        <DataTable caption={text.rosterCaption} columns={COLUMNS} rows={rows} rowKey={(r) => r.key} empty={text.rosterEmpty} />
        <p>{text.rosterNote}</p>
      </Card>
      <Card title={text.fingerprintsTitle}>
        <p>{text.fingerprintsNote}</p>
        <p>{text.fingerprintsMeaning}</p>
        <p>{text.trail}</p>
      </Card>
      {data.extensionReasons.length > 0 ? (
        <Card title={text.reasonsTitle}>
          <ul>{reasonLines(data.extensionReasons, messagesHr.deadlineExtensions.reasons).map((line, i) => <li key={i}>{line}</li>)}</ul>
          <p>{text.reasonsNote}</p>
        </Card>
      ) : null}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {submitted ? <Button onClick={prepare} busy={preparing}>{ended ? text.prepareAgain : text.prepare}</Button> : null}
        <Button tone="quiet" onClick={() => port.leaveFor(port.csvPath(assignmentId))}>{text.csv}</Button>
      </div>
    </>
  );
}
