import type { ReactNode } from "react";

import { BASE } from "../../src/bases";
import Host from "../../src/host/Host";
import { LocaleProvider } from "../../src/i18n/LocaleProvider";

// The pages were rendered per request while the segment [base] was dynamic;
// the group (host) has no dynamic segment, so say it (the host reads the session
// and the query in the browser, nothing is prerendered).
export const dynamic = "force-dynamic";

/**
 * Everything under /aplikacija/ (D-318): the host reads the session and puts
 * the page of the path in the shell. The interface language (D-70) holds for all of it.
 */
export default function BaseLayout({ children }: { children: ReactNode }) {
  return <LocaleProvider><Host base={BASE}>{children}</Host></LocaleProvider>;
}
