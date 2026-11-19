"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import AppShell from "../../shell/AppShell";

import { currentTeacherItem } from "./teacher-shell";

/**
 * The teacher's shell around the page: the side bar marks the place the path
 * belongs to, and the breadcrumb names it. The role was read on the server.
 */
export default function TeacherShellFrame({ account, institution, children }: {
  account: ReactNode;
  institution: string | null;
  children: ReactNode;
}) {
  const item = currentTeacherItem(usePathname() ?? "");
  return (
    <AppShell role="teacher" scope={null} current={item?.href} crumbs={item === undefined ? [] : [item.label]} account={account} institution={institution}>
      {children}
    </AppShell>
  );
}
