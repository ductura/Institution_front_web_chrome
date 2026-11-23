// P-D1: the "Probni" mark of the N-01 card and the task facts. teacher.courses.get does not carry the
// practice flag; institution.assignment.get does (`isPractice`), so each assignment is read once through
// src/client. A failed or missing read is "not practice": the badge is never guessed (rules in model.ts).
import { useEffect, useState } from "react";

import { readAssignmentVersion } from "../../../../../../src/client/teacher-assignment";
import { readPractice } from "./model";

/** The flags of a course's assignments, read once per set of ids; empty until the reads answer. */
export function usePractice(assignments: readonly { readonly id: string }[]): ReadonlyMap<string, boolean> {
  const [flags, setFlags] = useState<ReadonlyMap<string, boolean>>(new Map());
  const key = assignments.map((a) => a.id).join("\n");
  useEffect(() => {
    let live = true;
    const ids = key === "" ? [] : key.split("\n");
    void readPractice(ids, (id) => readAssignmentVersion(id)).then((answer) => {
      if (live) setFlags(answer);
    });
    return () => {
      live = false;
    };
  }, [key]);
  return flags;
}
