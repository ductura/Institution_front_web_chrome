import { redirect } from "next/navigation";

import { signInHref } from "@/client/api";
import SignInScreen from "@/components/auth/SignInScreen";
import AppShell from "@/components/shell/AppShell";
import NoRoleCard from "@/components/shell/NoRoleCard";
import ShellSignOut from "@/components/shell/ShellSignOut";
import { readShellAccess } from "@/components/shell/shell-read";
import { signInDecision, type SignInState } from "@/components/shell/sign-in-state";
import { messagesHr as t } from "@/lib/i18n/messages.hr";

export const dynamic = "force-dynamic";
export const metadata = { title: `${t.prijava.title} · ${t.app.name}` };

const NOTICES: Readonly<Record<Exclude<SignInState, "signIn" | "noRole">, { title: string; body: string; alert?: boolean }>> = {
  signedOut: { title: t.signInState.signedOutTitle, body: t.signInState.signedOutBody },
  expired: { title: t.access.expiredTitle, body: t.access.expiredBody },
  failed: { title: t.auth.failedTitle, body: t.auth.failedBody, alert: true },
  unavailable: { title: t.signInState.unavailableTitle, body: t.auth.unavailableBody, alert: true },
};

// WEB-08 (E-1): sign-in only through AAI@EduHr (D-09, D-16), by the server's
// auth.login.get. The session is read from the server session read (me); the page never
// reads the database. An account without a role (403) sees A-5 with "Odjava".
export default async function PrijavaPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const decision = signInDecision(await readShellAccess(), await searchParams);
  if (decision.kind === "redirect") redirect(decision.to);
  if (decision.state === "noRole") {
    return (
      <AppShell role={null} scope={null} crumbs={[]} account={<ShellSignOut />}>
        <NoRoleCard />
      </AppShell>
    );
  }
  const href = signInHref(decision.returnTo ?? undefined);
  return <SignInScreen href={href} notice={decision.state === "signIn" ? undefined : NOTICES[decision.state]} />;
}
