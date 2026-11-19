import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { baseOfSegment } from "../../src/bases";
import Host from "../../src/host/Host";

/**
 * Everything under /app/web/ and /app/chrome/ (#2028 c.6993786629 §1): the
 * host reads the session and puts the page of the path in the shell; any
 * other segment is not found.
 */
export default async function BaseLayout({ params, children }: { params: Promise<{ base: string }>; children: ReactNode }) {
  const base = baseOfSegment((await params).base);
  if (base === null) notFound();
  return <Host base={base}>{children}</Host>;
}
