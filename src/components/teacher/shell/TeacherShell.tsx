import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { messagesHr as t } from "../../../lib/i18n/messages.hr";

import AppShell from "../../shell/AppShell";
import { homeHref } from "../../shell/nav";
import NoRoleCard from "../../shell/NoRoleCard";
import { signInPage } from "../../shell/RoleShell";
import { readShellAccess } from "../../shell/shell-read";
import ShellSignOut from "../../shell/ShellSignOut";

import TeacherShellFrame from "./TeacherShellFrame";
import { TEACHER_HOME, teacherShellView } from "./teacher-shell";

/**
 * WEB-17 (A-9): the shell of every /nastavnik page, over the shared shell of
 * WEB-08. One session read (me) on the institution server decides it: no
 * session goes to the sign-in, an account without a role sees A-5, another
 * role sees its own shell and that this view is for teachers, and a teacher
 * gets the four places of the teacher's side bar.
 */
export default async function TeacherShell({ children }: { children: ReactNode }) {
  const view = teacherShellView(await readShellAccess());
  if (view.kind === "signIn") redirect(signInPage(TEACHER_HOME));
  const account = <ShellSignOut />;
  if (view.kind === "noRole") {
    return (
      <AppShell role={null} scope={null} crumbs={[]} account={account}>
        <NoRoleCard />
      </AppShell>
    );
  }
  if (view.kind === "otherRole") {
    return (
      <AppShell role={view.role} scope={null} crumbs={[t.access.deniedTitle]} account={account} institution={view.institution}>
        <section className="page" aria-labelledby="nije-nastavnik-naslov">
          <h1 id="nije-nastavnik-naslov">{t.access.deniedTitle}</h1>
          <p>{t.access.deniedBody}</p>
          <p><a href={homeHref(view.role)}>{t.access.backToOwn}</a></p>
        </section>
      </AppShell>
    );
  }
  return (
    <TeacherShellFrame account={account} institution={view.institution}>
      {children}
    </TeacherShellFrame>
  );
}
