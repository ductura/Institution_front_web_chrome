import NewAssignmentPage from "../../../../../src/host/teacher/assignment/new-assignment";

export default async function Page({ searchParams }: {
  searchParams: Promise<{ kolegij?: string | string[] }>;
}) {
  const { kolegij } = await searchParams;
  return <NewAssignmentPage courseId={kolegij} />;
}
