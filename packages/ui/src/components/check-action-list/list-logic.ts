export type CheckSeverity = "required" | "advisory";

export type CheckAction = {
  /** Stable id of the action, returned to the app as chosen. */
  id: string;
  label: string;
};

export type CheckFinding = {
  /** Stable id of the finding; never an index. */
  id: string;
  severity: CheckSeverity;
  title: string;
  detail?: string;
  actions: readonly CheckAction[];
};

export type CheckSelection = { findingId: string; actionId: string };

/** Required findings first, advisory after; the app's order is kept inside each group. */
export function orderFindings(findings: readonly CheckFinding[]): CheckFinding[] {
  return [
    ...findings.filter((finding) => finding.severity === "required"),
    ...findings.filter((finding) => finding.severity === "advisory"),
  ];
}

/** The selection an app receives, or null when the finding or action is not in the list. */
export function selectionOf(findings: readonly CheckFinding[], findingId: string, actionId: string): CheckSelection | null {
  const finding = findings.find((item) => item.id === findingId);
  if (!finding || !finding.actions.some((action) => action.id === actionId)) return null;
  return { findingId, actionId };
}
