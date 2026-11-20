import { Card } from "@ductura/ui";

import { VersionComparison, type VersionComparisonProps } from "../../editor/diff/VersionComparison";
import { comparisonHr as t } from "../../editor/diff/messages.hr";

/** N-11: mount in the teacher's work view. */
export function TeacherVersionComparison(props: VersionComparisonProps) {
  return <Card title={t.title}><VersionComparison {...props} /></Card>;
}
