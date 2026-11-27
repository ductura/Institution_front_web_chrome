import { notFound } from "next/navigation";

import QuestionnaireExportPage from "../../../../../../src/host/teacher/questionnaire-export/QuestionnaireExportPage";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Teacher: "Izvoz odgovora upitnika" (WEB-V18-UPITNIK-IZVOZ). A malformed id is the same "not found" as an unknown one. */
export default async function Page({ params }: { params: Promise<{ questionnaireId: string }> }) {
  const { questionnaireId } = await params;
  if (!uuid.test(questionnaireId)) notFound();
  return <QuestionnaireExportPage questionnaireId={questionnaireId.toLowerCase()} />;
}
