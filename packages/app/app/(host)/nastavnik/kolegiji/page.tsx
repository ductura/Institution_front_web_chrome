import { redirect } from "next/navigation";

// Z3 (A), from Ductus src/app/nastavnik/kolegiji/page.tsx: the teacher's entry
// is /nastavnik, the list of their courses. Old links and sign-in returnTo
// values still arrive here, so this route only forwards, under the same base.
// NZ-1 (WEB-NUZ-NZ): the query goes along, so the banner of an interrupted
// publish (`?objava=prekinuta&kolegij=…&zadatak=…`) is seen on /nastavnik.
type Search = Record<string, string | string[] | undefined>;

export default async function TeacherCoursesRedirect({ params, searchParams }: {
  params: Promise<{ base: string }>; searchParams: Promise<Search>;
}): Promise<never> {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    for (const one of Array.isArray(value) ? value : value === undefined ? [] : [value]) query.append(key, one);
  }
  const rest = query.toString();
  redirect(`/${encodeURIComponent((await params).base)}/nastavnik${rest === "" ? "" : `?${rest}`}`);
}
