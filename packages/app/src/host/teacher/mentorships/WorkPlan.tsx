"use client";

// WEB-NF6-ETAPE (NF-6 MK-5, MK-6): one work of a mentorship on N-16 in one view: its stages with state, due
// date, description and the mentor's note (the shared "Etape" card, WEB-1520: odobri, zatraži doradu s rokom,
// uredi rokove), the plan writes beside it, and what was agreed at the latest consultation.
import { useCallback, useState } from "react";

import { StagesCard } from "../../../../../../src/components/editor/mentor/milestones/StagesCard";
import { mentorPlanText as t } from "./messages.hr";
import { AgreedCard, type RecordsRead } from "./AgreedCard";
import { PlanActions } from "./PlanActions";
import type { PlanCall } from "./plan-actions";

const always = () => true;

export function WorkPlan({ documentId, name, title, base, onSignedOut, plan, records }: {
  documentId: string; name: string; title: string; base: string; onSignedOut: () => void;
  plan?: () => PlanCall; records?: RecordsRead;
}) {
  const [revision, setRevision] = useState(0);
  const reread = useCallback(() => setRevision((n) => n + 1), []);
  const heading = t.work.replace("{name}", name).replace("{title}", title);
  return (
    <section aria-label={heading} data-testid="mentor-work-plan">
      <h2>{heading}</h2>
      <StagesCard key={revision} mentor documentId={documentId} current={always} onSessionEnd={onSignedOut} />
      <PlanActions documentId={documentId} onChanged={reread} onSignedOut={onSignedOut} call={plan} />
      <AgreedCard documentId={documentId} base={base} read={records} />
    </section>
  );
}
