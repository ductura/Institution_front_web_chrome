import { redirect } from "next/navigation";

import { homeHref } from "@/components/shell/nav";
import { readShellAccess } from "@/components/shell/shell-read";
import { messagesHr as t } from "@/lib/i18n/messages.hr";

export const dynamic = "force-dynamic";

// WEB-08: the public home. A signed-in person goes on to their role's home
// (a student to "Moji zadaci"), an account without a role to /prijava, which
// shows A-5. Everyone else sees the public page with the way to sign in.
export default async function HomePage() {
  const access = await readShellAccess();
  if (access.kind === "signedIn") redirect(homeHref(access.role));
  if (access.kind === "noRole") redirect("/prijava");
  return (
    <main id="sadrzaj" className="page">
      <p>{t.landing.eyebrow}</p>
      <h1>
        {t.landing.title} {t.landing.titleAccent}
      </h1>
      <p>{t.landing.intro}</p>
      <p>{t.landing.aaiOnly}</p>
      <p>
        <a className="btn" href="/prijava">{t.auth.signIn}</a>
      </p>
    </main>
  );
}
