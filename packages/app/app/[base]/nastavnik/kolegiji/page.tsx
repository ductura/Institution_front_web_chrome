import { redirect } from "next/navigation";

// Z3 (A), from Ductus src/app/nastavnik/kolegiji/page.tsx: the teacher's entry
// is /nastavnik, the list of their courses. Old links and sign-in returnTo
// values still arrive here, so this route only forwards, under the same base.
export default async function TeacherCoursesRedirect({ params }: { params: Promise<{ base: string }> }): Promise<never> {
  redirect(`/${encodeURIComponent((await params).base)}/nastavnik`);
}
