import { notFound } from "next/navigation";

import { baseOfSegment } from "../../../../../src/bases";
import { PilotMetrics } from "../../../../../src/host/operator/pilot-metrics/PilotMetrics";
import { pilotMetricsMessages as t } from "../../../../../src/host/operator/pilot-metrics/messages.hr";

export const metadata = { title: t.title };

export default async function Page({ params }: { params: Promise<{ base: string }> }) {
  const base = baseOfSegment((await params).base);
  if (base === null) notFound();
  return <PilotMetrics home={`${base}/`} />;
}
