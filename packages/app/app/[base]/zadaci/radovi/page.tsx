import { paramOf } from "../../../../../../src/components/student/radovi/works-view";
import { MyWorksPage } from "../../../../src/host/student/other";

/** S "Moji radovi" (WEB-10): student.assignments.get and student.assignment-work.get; HOST-S5. */
export default async function Page({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  return <MyWorksPage filter={{ q: paramOf(query.q), year: paramOf(query.godina) }} />;
}
