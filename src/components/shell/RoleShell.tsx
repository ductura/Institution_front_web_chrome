import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import AppShell from "./AppShell";
import NoRoleCard from "./NoRoleCard";
import { readShellAccess } from "./shell-read";
import ShellSignOut from "./ShellSignOut";

export type RoleShellProps = {
  /** This page's path: the sign-in returns here. */
  here: string;
  /** The navigation item this page belongs to. */
  current?: string;
  crumbs: readonly string[];
  children: ReactNode;
};

/** The sign-in page for `here`, with the path checked again by the login route. */
export function signInPage(here: string): string {
  return `/prijava?returnTo=${encodeURIComponent(here)}`;
}

/**
 * WEB-08 (E-0): the signed-in shell of every role's page. The role comes from
 * the server session read (me); no session (or no answer) goes to /prijava, which tells
 * the two apart, and an account without a role sees only A-5 and "Odjava".
 */
export default async function RoleShell({ here, current, crumbs, children }: RoleShellProps) {
  const access = await readShellAccess();
  if (access.kind === "signedOut" || access.kind === "unavailable") redirect(signInPage(here));
  const account = <ShellSignOut />;
  if (access.kind === "noRole") {
    return (
      <AppShell role={null} scope={null} crumbs={[]} account={account}>
        <NoRoleCard />
      </AppShell>
    );
  }
  return (
    <AppShell role={access.role} scope={null} current={current} crumbs={crumbs} account={account} institution={access.institution}>
      {children}
    </AppShell>
  );
}
