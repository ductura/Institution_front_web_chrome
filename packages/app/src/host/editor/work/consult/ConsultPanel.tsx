"use client";

// WEB-2122 (PARITET EditorPageWork dio 2): consultations and grading criteria of the Mentor card.
// The caller owns the transports (`slotsCall`, `criteriaCall`) and the role; this file reaches the server
// only through the shared client in src/client.
import type { SlotsApi } from "../../../../../../../src/client/consultation-slots";
import type { StudentCriteriaCall } from "../../../../../../../src/client/student-working-criteria";
import type { CriteriaCall } from "../../../../../../../src/client/teacher-working-criteria";

import { ConsultCriteria } from "./ConsultCriteria";
import { ConsultRecords } from "./ConsultRecords";
import { ConsultSlots } from "./ConsultSlots";
import { StudentCriteria } from "./StudentCriteria";
import type { Role } from "./consult-model";

export type ConsultPanelProps = {
  documentId: string;
  role: Role;
  /** The revision a new record refers to. */
  revision: number;
  slotsCall: SlotsApi | null;
  /** Null until the server's working-criteria operations exist: the card says "nedostupno". */
  criteriaCall: CriteriaCall | null;
  /** ED-35: the student's read of each teacher's criteria (student.working-criteria.get); null says "nedostupno". */
  studentCriteriaCall?: StudentCriteriaCall | null;
  onSessionEnd?: () => void;
  /** The assignment has a rubric: it replaces the working criteria (WEB-V17-DORADE). */
  byRubric?: boolean;
};

export function ConsultPanel({ documentId, role, revision, slotsCall, criteriaCall, studentCriteriaCall, onSessionEnd, byRubric }: ConsultPanelProps) {
  return (
    <div data-consult-panel="">
      <ConsultSlots documentId={documentId} role={role} call={slotsCall} onSessionEnd={onSessionEnd} />
      <ConsultRecords documentId={documentId} role={role} revision={revision} />
      {role === "student" && !byRubric
        ? <StudentCriteria documentId={documentId} call={studentCriteriaCall ?? null} onSessionEnd={onSessionEnd} />
        : <ConsultCriteria documentId={documentId} role={role} call={criteriaCall} onSessionEnd={onSessionEnd} byRubric={byRubric} />}
    </div>
  );
}
