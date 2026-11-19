import { notFound } from "next/navigation";

import { baseOfSegment } from "../../../src/bases";
import Host from "./Host";

/**
 * Every path under /app/web/ and /app/chrome/ (#2028 c.6993786629 §1). Until
 * the pages move to routes of their own, the host reads the session and picks
 * the page of the path (src/App.tsx, src/routes.ts) in the browser.
 */
export default async function Page({ params }: { params: Promise<{ base: string }> }) {
  const base = baseOfSegment((await params).base);
  if (base === null) notFound();
  return <Host base={base} />;
}
