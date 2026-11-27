"use client";

import { useEffect, useState } from "react";
import { Button } from "@ductura/ui";

import {
  accessAfter, accessFrom, accessNote, directEditBadge, editMessage, segmentMark, submitTeacherEdit,
  type EditAccess, type MarkedSegment, type TeacherEditPort,
} from "./model";
import { directEditMessages as text } from "./messages.hr";

/**
 * The teacher's direct-edit area on a work (WEB-1703; M6.4). It shows the student's mark, the
 * work with the teacher's text marked, and a field that exists only while the student allows
 * edits. A refused write (revocation) closes the field at once and keeps the typed text out of
 * the work.
 */
export default function TeacherDirectEdit(
  { assignmentId, port, segments, onSaved, writable = true }:
  { assignmentId: string; port: TeacherEditPort; segments: readonly MarkedSegment[]; onSaved?: (body: string) => void; writable?: boolean },
) {
  const [access, setAccess] = useState<EditAccess | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    void port.read(assignmentId)
      .then((read) => { if (active) setAccess(accessFrom(read)); })
      .catch(() => { if (active) setAccess({ kind: "locked", reason: "unavailable" }); });
    return () => { active = false; };
  }, [assignmentId, port, attempt]);

  if (access === null) return null;
  const open = access.kind === "open";
  const canType = open && writable;

  const save = async () => {
    setBusy(true);
    const result = await submitTeacherEdit(port, assignmentId, access, draft);
    setBusy(false);
    setNote(editMessage(result));
    setAccess(accessAfter(access, result));
    if (result.kind === "saved") { onSaved?.(result.text); setDraft(""); }
  };

  return (
    <section aria-label={text.title}>
      <h2>{text.title}</h2>
      <p data-direct-edit-badge={open ? "on" : "off"}>{directEditBadge(open)}</p>
      <div>
        {segments.map((segment, index) => {
          const mark = segmentMark(segment);
          return (
            <p key={index} data-author={segment.author}>
              {mark !== null ? <strong>{mark}: </strong> : null}{segment.text}
            </p>
          );
        })}
      </div>
      <p>{accessNote(access)}</p>
      {open && !writable ? <p role="status">{text.noRoute}</p> : null}
      {canType ? (
        <>
          <label>{text.field}<textarea value={draft} onChange={(event) => setDraft(event.target.value)} /></label>
          <Button disabled={busy || draft.trim() === ""} onClick={() => void save()}>{text.save}</Button>
        </>
      ) : access.kind === "locked" && access.reason === "unavailable" ? (
        <Button onClick={() => setAttempt((n) => n + 1)}>{text.retry}</Button>
      ) : null}
      <p role="status" aria-live="polite">{note}</p>
    </section>
  );
}
