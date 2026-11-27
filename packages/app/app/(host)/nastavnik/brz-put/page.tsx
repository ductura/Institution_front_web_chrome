import { Suspense } from "react";

import FastPathPage from "../../../../src/host/teacher/n05/FastPathPage";

// Source: Ductus src/app/nastavnik/brz-put/page.tsx. The works come from teacher.fast-path.post through
// src/components/teacher/fast-path/read.ts (WEB-2142).
/** "Brz put": the works of one assignment, one after another, read only. */
export default function Page() {
  return (
    <Suspense>
      <FastPathPage />
    </Suspense>
  );
}
