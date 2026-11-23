"use client";

import { useEffect, useRef, useState } from "react";
import { Button, Card, Fingerprint, Select } from "@ductura/ui";

import { newRequestKey, packageView } from "../../../../../../src/client/merlin-export.ts";
import { messagesHr } from "../../../../../../src/lib/i18n/messages.hr.ts";
import { merlinMessages as text } from "./messages.hr";
import {
  COLUMN_HEADERS, POLL_MS, canDownload, hasSubmitted, reasonLines, rowCells, statusLines,
  type ExportStatus, type MerlinData, type MerlinPackage, type MerlinPort,
} from "./model";

const IDS = ["familyName", "givenName", "submitted", "submittedMinute", "afterDeadline", "fileName", "pdfSha256", "docxSha256"] as const;
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
  const selectField = options.some((option) => option.value === assignmentId) ? (
    <div style={{ maxWidth: 420 }}>
      <Select label={text.taskLabel} options={options} value={assignmentId} onChange={(event) => onChoose?.(event.target.value)} />
    </div>
  ) : null;

  const heading = said === null ? null : said.lines[0];
  if (!submitted) {
    return (
      <>
        {selectField}
        <Card level={2} title={text.emptyTitle} center><p className="note">{text.emptyBody}</p></Card>
      </>
    );
  }
  return (
    <>
      {selectField}
      {said === null ? null : status.kind === "pending" || (status.kind === "view" && status.view.kind === "priprema") ? (
        <p className="note" role="status" aria-live="polite" data-testid="merlin-status">
          <span className="sb-spin" aria-hidden="true" /> {said.lines[0]}
        </p>
      ) : (
        <div className="banner" role={said.tone} aria-live="polite" data-testid="merlin-status">
          {canDownload(status) ? (
            <>
              <p><b>{heading}</b> {said.lines[1]}</p>
              <div className="sb-state">
                <span className="sb-h">{text.packageFingerprint}</span>
                <Fingerprint value={status.view.sha256} />
                <span className="meta">{text.packageFingerprintNote}</span>
              </div>
              <div className="acts"><Button onClick={download} busy={busy}>{text.download}</Button></div>
            </>
          ) : said.lines.map((line) => <p key={line}>{line}</p>)}
        </div>
      )}
      <Card level={2} title={text.rosterTitle}>
        {rows.length === 0 ? <p className="note">{text.rosterEmpty}</p> : (
          <div className="tbl" tabIndex={0} role="region" aria-label={text.rosterCaption}>
            <table>
              <thead><tr>{IDS.map((id, i) => <th key={id} scope="col">{COLUMN_HEADERS[i] ?? id}</th>)}</tr></thead>
              <tbody>{rows.map((r) => (
                <tr key={r.key}>{IDS.map((id, i) => <td key={id} className={i >= 5 ? "mono" : undefined}>{r.cells[i] ?? text.none}</td>)}</tr>
              ))}</tbody>
            </table>
          </div>
        )}
        <p className="meta">{text.rosterNote}</p>
      </Card>
      <Card level={2} title={text.fingerprintsTitle}>
        <p className="note">{text.fingerprintsNote}</p>
        <p className="note">{text.fingerprintsMeaning}</p>
        <p className="meta">{text.trail}</p>
      </Card>
      {data.extensionReasons.length > 0 ? (
        <Card level={2} title={text.reasonsTitle}>
          <ul>{reasonLines(data.extensionReasons, messagesHr.deadlineExtensions.reasons).map((line, i) => <li key={i}>{line}</li>)}</ul>
          <p>{text.reasonsNote}</p>
        </Card>
      ) : null}
      <div className="acts">
        <Button onClick={prepare} busy={preparing}>{ended ? text.prepareAgain : text.prepare}</Button>
        <Button tone="secondary" onClick={() => port.leaveFor(port.csvPath(assignmentId))}>{text.csv}</Button>
      </div>
    </>
  );
}
