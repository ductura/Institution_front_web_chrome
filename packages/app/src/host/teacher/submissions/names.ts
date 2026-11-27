"use client";

// WEB-PREDAJE-IMENA: the names the submissions list shows instead of the student's id. The source is the
// existing teacher.assignment-overview.get read (one row per student with the name), through the page's
// transport; no new route. A read that fails leaves the map empty, so the list falls back to the id as before.
import { useEffect, useState } from "react";

import { readAssignmentOverview, type OverviewRow, type TeacherCall } from "../../../../../../src/client/teacher-reads.ts";

export type StudentNames = Readonly<Record<string, string>>;

/** The student id → name map of the rows that name a student; a row without a name adds nothing. */
export function namesOf(rows: readonly OverviewRow[]): StudentNames {
  const names: Record<string, string> = {};
  for (const row of rows) if (row.name !== null) names[row.studentId] = row.name;
  return names;
}

/** Reads the names of one assignment once; `onSignedOut` is called when the session has ended. */
export function useStudentNames(call: TeacherCall, assignmentId: string, onSignedOut: () => void): StudentNames {
  const [state, setState] = useState<{ assignmentId: string; names: StudentNames } | null>(null);
  useEffect(() => {
    let active = true;
    void readAssignmentOverview(call, assignmentId).then((read) => {
      if (!active) return;
      if (read.kind === "session-expired") onSignedOut();
      setState({ assignmentId, names: read.kind === "ready" ? namesOf(read.rows) : {} });
    });
    return () => { active = false; };
  }, [call, assignmentId, onSignedOut]);
  return state?.assignmentId === assignmentId ? state.names : {};
}
