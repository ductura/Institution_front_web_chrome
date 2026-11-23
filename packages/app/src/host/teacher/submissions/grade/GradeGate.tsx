"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Button, Notice, PracticeBadge } from "@ductura/ui";

import { gradeSlot, readGrade, type GradeCall, type GradeRead } from "./contract";
import { gradeMessages as text } from "./messages.hr";

/** Reads the grade route once per assignment (and again on retry); an ended session calls `onSignedOut`. */
export function useGradeRead(call: GradeCall, assignmentId: string, onSignedOut: () => void): { read: GradeRead | null; retry: () => void } {
  const [state, setState] = useState<{ assignmentId: string; read: GradeRead } | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    void readGrade(call, assignmentId).then((read) => {
      if (!active) return;
      if (read.kind === "signedOut") onSignedOut();
      setState({ assignmentId, read });
    });
    return () => { active = false; };
  }, [call, assignmentId, attempt, onSignedOut]);
  const retry = useCallback(() => { setState(null); setAttempt((n) => n + 1); }, []);
  return { read: state?.assignmentId === assignmentId ? state.read : null, retry };
}

/** The calm note of a practice assignment: a status, never an alert. */
export function PracticeNotice() {
  return (
    <Notice>
      <PracticeBadge practice /> <strong>{text.practiceTitle}</strong>
      <span> {text.practiceBody}</span>
    </Notice>
  );
}

/** Shows the grade and export actions (`children`) only for a confirmed regular assignment. */
export function GradeGate({ read, onRetry, children }: { read: GradeRead | null; onRetry: () => void; children: ReactNode }) {
  const slot = gradeSlot(read);
  if (slot === "actions") return <>{children}</>;
  if (slot === "practice") return <PracticeNotice />;
  if (slot === "waiting") return <p role="status">{text.checking}</p>;
  if (slot === "unavailable") {
    return (
      <div>
        <p role="status">{text.unavailable}</p>
        <Button tone="quiet" onClick={onRetry}>{text.retry}</Button>
      </div>
    );
  }
  return null;
}
