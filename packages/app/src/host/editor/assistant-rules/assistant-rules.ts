// ED-09 (NF2-P9): the rules of the assignment for the Asistent card and the assignment's
// instructions for "Prvi redak", from one read of `student.notice.get` per assignment.
import { useEffect, useState } from "react";

import { readStudentNotice, type StudentNoticeRead } from "../../../../../../src/client/student-notice.ts";
import { AI_PURPOSES, type AiPurpose } from "../../../../../../src/components/teacher/assignment-create.ts";
import { assistantRulesHr as t } from "./messages.hr";

export type RulesView =
  | { kind: "loading" }
  | { kind: "unavailable" }
  | { kind: "rules"; policy: string; purposes: readonly { key: AiPurpose; label: string; allowed: boolean }[] | null };

type Policy = keyof typeof t.policy;
const isPolicy = (value: string): value is Policy => value in t.policy;

/** The card's content: the policy line and, unless tools are prohibited, every purpose with ✓ or ×. */
export function rulesViewOf(read: StudentNoticeRead | null): RulesView {
  if (read === null) return { kind: "loading" };
  if (read.kind !== "available" || !isPolicy(read.view.aiPolicy)) return { kind: "unavailable" };
  const policy = read.view.aiPolicy;
  if (policy === "prohibited") return { kind: "rules", policy: t.policy.prohibited, purposes: null };
  const allowed = new Set(read.view.aiPurposes);
  return {
    kind: "rules",
    policy: t.policy[policy],
    purposes: AI_PURPOSES.map((key) => ({ key, label: t.purposes[key], allowed: allowed.has(key) })),
  };
}

/** The instructions "Prvi redak" shows; null while loading or when the notice cannot be read. */
export function instructionsOf(read: StudentNoticeRead | null): string | null {
  if (read?.kind !== "available") return null;
  const text = read.view.instructions.trim();
  return text === "" ? null : text;
}

export const noticePath = (assignmentId: string) => `/zadatak/${encodeURIComponent(assignmentId)}`;
export const declarationPath = (assignmentId: string) => `/rad/${encodeURIComponent(assignmentId)}/predaja/izjava`;
/** The work itself: where a sign-in from the declaration's dialog comes back to. */
export const workPath = (assignmentId: string) => `/rad/${encodeURIComponent(assignmentId)}`;

type Reader = (assignmentId: string) => Promise<StudentNoticeRead>;
const cache = new Map<string, Promise<StudentNoticeRead>>();

/** One read per assignment, shared by the card and "Prvi redak"; a failed read is asked again next time. */
export function noticeOnce(assignmentId: string, read: Reader = readStudentNotice): Promise<StudentNoticeRead> {
  const known = cache.get(assignmentId);
  if (known) return known;
  const pending = read(assignmentId).then((result) => {
    if (result.kind !== "available") cache.delete(assignmentId);
    return result;
  });
  cache.set(assignmentId, pending);
  return pending;
}

/** Test seam: forget every read. */
export function forgetNotices(): void {
  cache.clear();
}

export function useAssignmentNotice(assignmentId: string): StudentNoticeRead | null {
  const [read, setRead] = useState<StudentNoticeRead | null>(null);
  useEffect(() => {
    let live = true;
    setRead(null);
    void noticeOnce(assignmentId).then((result) => { if (live) setRead(result); });
    return () => { live = false; };
  }, [assignmentId]);
  return read;
}
