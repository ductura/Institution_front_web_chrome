import type { ReactNode } from "react";

import TeacherShell from "@/components/teacher/shell/TeacherShell";

export const dynamic = "force-dynamic";

// WEB-17 (A-9): every /nastavnik page in the teacher's shell; the session read
// (me) on the institution server decides who sees it.
export default function TeacherLayout({ children }: { children: ReactNode }) {
  return <TeacherShell>{children}</TeacherShell>;
}
