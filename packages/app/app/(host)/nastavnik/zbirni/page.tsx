import { Suspense } from "react";

import { AssignmentOverviewPage } from "../../../../src/host/teacher/overview";

/** N-17 "Zbirni" (teacher.assignment-overview.get); HOST-T3. */
export default function Page() {
  return (
    <Suspense>
      <AssignmentOverviewPage />
    </Suspense>
  );
}
