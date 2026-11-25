"use client";

import { navLabel, useLocale } from "../../../i18n";
import { useHost } from "../../context";

/** WEB-V22-RUTE: thin route of the trial grade export; WEB-V22-OCJENE-EKRAN replaces the body. The host checks the role (teacher); the course is the path's segment. */
export default function IsvuGradesRoute({ courseId }: { courseId: string }) {
  const { page, role } = useHost();
  const label = navLabel(page, role, useLocale());
  return (
    <section className="page" data-role={role ?? undefined} data-course={courseId}>
      <h1>{label}</h1>
    </section>
  );
}
