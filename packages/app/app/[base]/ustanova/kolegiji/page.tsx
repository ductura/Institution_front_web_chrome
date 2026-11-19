import { PendingPage } from "../../../../src/host/pages";

// TREBA API: a read of the academic years and the institution's courses (Ductus readAcademicYears, readInstitutionCourses); the contract has no read for it.
// Source: Ductus src/app/ustanova/kolegiji/page.tsx, copied to src/app/ustanova/kolegiji/.
/** A-03 the courses, teams and groups by academic year, read only. */
export default function Page() {
  return <PendingPage />;
}
