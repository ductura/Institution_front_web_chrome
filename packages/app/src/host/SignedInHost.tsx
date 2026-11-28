"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";

import { RouteLoading, SideShell } from "@ductura/ui";

import { appHref, HOW_IT_WORKS_HREF, homeHref, navFor } from "../../../../src/components/shell/nav.ts";
import ErrorScreen from "../../../../src/components/shell/ErrorScreen.ts";
import { goToSignIn, readSession, type SessionRead } from "../../../../src/client/api.ts";

import type { Base } from "../bases";
import { browserRoute, publicPage, resolve, shellRole } from "../routes";
import { useLocale } from "../i18n";
import { isNarrow, withoutShell } from "./ljuska-po-ekranu";
import { HostContext } from "./context";
import { useDocumentTitle } from "./document-title";
import { EditorSignOutSlot } from "./editor/save-status/SignOutSlot";
import { RecoveryOffer } from "./editor/save-status/RecoveryOffer";
import ProblemReportHelp from "./ProblemReportHelp";
import SignOut from "./SignOut";
import { StudentToasts } from "./student/toast/StudentToasts";
import { NoRoleScreen } from "./signin/SignInScreen";
import ShellNotifications from "./shell/notifications/ShellNotifications";
import { shellMessagesFor } from "./teacher/shell/messages";

/**
 * The pages of the shell (#2028 c.6993786629 §3.3), loaded by the host only off
 * the public pages (DAN-1571): reads the session once, sends a signed-out browser
 * to AAI@EduHr sign-in (D-09), and shows the page of the path for the session's
 * role inside the prototypes' shell (VIZ-0: no top bar, so no breadcrumb; the
 * institution's name moves to the side bar's foot).
 */
export default function SignedInHost({ base, route, navigate, detail, signedOutPage = null, children }: {
  base: Base;
  route: string;
  detail: string | null;
  /** A public page that also has the shell: shown bare, with no sign-in forced, to anyone without a session. */
  signedOutPage?: ReactNode;
  navigate: (to: string, replace?: boolean) => void;
  children: ReactNode;
}) {
  const [session, setSession] = useState<SessionRead | null>(null);
  const keepsSignIn = signedOutPage !== null;
  const { t, app: { host: hostText }, ui, syncFromServer } = useLocale();

  const load = useCallback(() => {
    setSession(null);
    void readSession().then((read) => {
      if (read.kind === "signedOut" && !keepsSignIn) goToSignIn(appHref(base, browserRoute(window.location.pathname, base)));
      setSession(read);
    });
  }, [base, keepsSignIn]);
  useEffect(() => {
    load();
  }, [load]);

  const signedIn = session?.kind === "signedIn" ? session.session : null;
  const role = signedIn === null ? null : shellRole(signedIn.role);
  // WEB-NUZ-OPERATER: the account kinds too, so the operator (no shell role) reaches its own page.
  const resolved = signedIn === null ? null : resolve(route, role, signedIn.roles);

  // The saved interface language (D-70) is read once the person is signed in.
  useEffect(() => {
    if (signedIn !== null) syncFromServer();
  }, [signedIn, syncFromServer]);

  useEffect(() => {
    if (resolved?.kind === "redirect") navigate(resolved.to, true);
  }, [resolved, navigate]);

  useDocumentTitle(resolved?.kind === "page" ? resolved.page : keepsSignIn && signedIn === null ? publicPage(route) : null, role, resolved?.kind === "notFound", detail);

  if (session === null) return <RouteLoading label={hostText.loading} />;
  if (signedOutPage !== null && session.kind !== "signedIn") return <>{signedOutPage}</>;
  if (session.kind === "signedOut") return <RouteLoading label={hostText.signingIn} />;
  if (session.kind === "unavailable" && session.noRole === true) return <NoRoleScreen />;
  if (session.kind === "unavailable") {
    return <ErrorScreen title={hostText.sessionUnavailableTitle} body={hostText.sessionUnavailable} onRetry={load} />;
  }
  if (resolved === null || resolved.kind === "redirect") return <RouteLoading label={hostText.loading} />;

  // VIZ-0: the prototypes' shell (SideShell of @ductura/ui): the 64 px rail with
  // the navigation and its foot, no top bar. The links the old top bar and side
  // bar carried stay, in the rail's foot.
  const shell = (current: string | undefined, body: ReactNode, ownMain = false, narrow = false) => {
    const shellText = shellMessagesFor(t, role);
    const link = (path: string) => appHref(base, path);
    return (
      <EditorSignOutSlot>
        <SideShell
          role={role}
          name={t.app.name}
          homeHref={link(homeHref(role))}
          homeLabel={{ student: hostText.homeLabelStudent, teacher: hostText.homeLabelTeacher, admin: hostText.homeLabelAdmin, none: ui.sideShell.home.none }[role ?? "none"]}
          sideLabel={shellText.shell.sideNav}
          navLabel={shellText.shell.workNav}
          items={navFor(role, shellText).map((item) => ({ href: link(item.href), label: item.label }))}
          current={current === undefined ? undefined : link(current)}
          menuLabel={ui.sideShell.menu}
          themeLabel={shellText.shell.theme}
          context={signedIn?.institution ?? null}
          links={[
            { href: link(HOW_IT_WORKS_HREF), label: shellText.shell.howItWorks },
            { href: link("/pristupacnost"), label: shellText.shell.accessibilityStatement },
          ]}
          help={(linkClass) => <ProblemReportHelp triggerClass={linkClass} />}
          tools={<ShellNotifications base={base} />}
          account={<SignOut base={base} />}
          ownMain={ownMain}
          narrow={narrow}
        >
          {role === "student" && <RecoveryOffer base={base} />}
          {role === "student" ? <StudentToasts>{body}</StudentToasts> : body}
        </SideShell>
      </EditorSignOutSlot>
    );
  };

  if (resolved.kind === "notFound") {
    return shell(undefined, <ErrorScreen title={t.errorPage.notFoundTitle} body={t.errorPage.notFoundBody} />, true);
  }
  if (resolved.kind === "noRole") {
    return shell(undefined, <section className="card"><h1>{t.home.welcome}</h1><p className="note">{hostText.noRole}</p></section>);
  }
  const { page } = resolved;
  // VIZ-CSS: the frame of each screen is the prototype's (ljuska-po-ekranu.ts). VIZ-S3 (S: E-7):
  // the student's workspace has `shell: 'none'`: the page is the whole window, with its own top bar and status bar.
  const frameRole = role === "student" || role === "teacher" ? role : null;
  if (withoutShell(route, frameRole)) {
    return (
      <EditorSignOutSlot>
        <RecoveryOffer base={base} />
        <StudentToasts><HostContext value={{ base, page, role }}>{children}</HostContext></StudentToasts>
      </EditorSignOutSlot>
    );
  }
  return shell(page.current, <HostContext value={{ base, page, role }}>{children}</HostContext>, false, isNarrow(route, frameRole));
}
