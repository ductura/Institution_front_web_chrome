import { notFound } from "next/navigation";

import { ConsultationRecords } from "@/components/teacher/consultation-records/ConsultationRecords";
import { consultationMessages as t } from "@/components/teacher/consultation-records/messages.hr";
import { liveWorkHref } from "@/components/teacher/LiveWorkFrame";
import { messagesHr } from "@/lib/i18n/messages.hr";

export const metadata = { title: `${t.title}, ${messagesHr.app.name}` };

export default async function ConsultationsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const workHref = liveWorkHref(id);
  if (workHref === null) notFound();
  return <ConsultationRecords key={id} documentId={id} workHref={workHref} />;
}
