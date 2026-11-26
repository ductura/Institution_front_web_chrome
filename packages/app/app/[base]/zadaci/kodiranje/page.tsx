import { Suspense } from "react";

import QualCodingRoute from "../../../../src/host/student/qual-coding/QualCodingPage";

/** Student: "Kodiranje" (WEB-V18-KODIRANJE-OZNAKE); the material is `?gradivo=`. */
export default function Page() {
  return (
    <Suspense>
      <QualCodingRoute />
    </Suspense>
  );
}
