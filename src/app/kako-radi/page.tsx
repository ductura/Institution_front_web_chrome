import { howItWorksShell } from "@/components/how-it-works/access";
import HowItWorks from "@/components/how-it-works/HowItWorks";
import AppShell from "@/components/shell/AppShell";
import { HOW_IT_WORKS_HREF } from "@/components/shell/nav";
import ShellSignOut from "@/components/shell/ShellSignOut";
import { readShellAccess } from "@/components/shell/shell-read";
import { messagesHr } from "@/lib/i18n/messages.hr";

export const dynamic = "force-dynamic";

const t = messagesHr.howItWorks;
export const metadata = { title: `${t.title} · ${messagesHr.app.name}` };

// DAN-431 (M11.10, J-02), WEB-13: "Kako Ductura radi". The page is static and
// the same for every reader, signed in or not; only the shell follows the
// server session read (me) on /api/v1. Nothing on it reads or writes data.
export default async function HowItWorksPage() {
  const shell = howItWorksShell(await readShellAccess());
  return (
    <AppShell
      role={shell.role}
      scope={null}
      current={HOW_IT_WORKS_HREF}
      crumbs={[t.title]}
      account={shell.signedIn ? <ShellSignOut /> : undefined}
      institution={shell.institution}
    >
      <HowItWorks />
    </AppShell>
  );
}
