import { DECLARED_PARAM } from "../../../../../../../../src/components/predaja/flow";
import { BeforeSubmitStepPage } from "../../../../../../src/host/student/submission";

/** Step 3, "Prije predaje" (WEB-25); HOST-S2. */
export default async function Page({ params, searchParams }: {
  params: Promise<{ assignmentId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { assignmentId } = await params;
  const declared = (await searchParams)[DECLARED_PARAM];
  return <BeforeSubmitStepPage assignmentId={assignmentId} declaredFor={typeof declared === "string" ? declared : undefined} />;
}
