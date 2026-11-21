import { Suspense } from "react";

import NoAccess from "./NoAccess";

// M1.8 (DAN-378): where a 401 or 403 leads. Public: an ended session cannot be read.
export default function Page() {
  return (
    <Suspense fallback={null}>
      <NoAccess />
    </Suspense>
  );
}
