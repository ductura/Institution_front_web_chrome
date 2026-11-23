import { notFound } from "next/navigation";

import { baseOfSegment } from "../../../../../src/bases";
import { PilotMetrics } from "../../../../../src/host/operator/pilot-metrics/PilotMetrics";
import { pilotMetricsMessages as t } from "../../../../../src/host/operator/pilot-metrics/messages.hr";
import { messagesHr } from "../../../../../../../locales/hr.ts";

// WCAG 2.4.2: the page's own name before the product's, as on every other route.
export const metadata = { title: `${t.title} · ${messagesHr.app.name}` };

export default async function Page({ params }: { params: Promise<{ base: string }> }) {
  const base = baseOfSegment((await params).base);
  if (base === null) notFound();
  return <PilotMetrics home={`${base}/`} />;
}
