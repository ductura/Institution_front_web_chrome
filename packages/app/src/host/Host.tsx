"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type ReactNode } from "react";

import { RouteLoading, SideShell } from "@ductura/ui";

import { appHref } from "../../../../src/components/index.ts";
import { HOW_IT_WORKS_HREF, homeHref, navFor } from "../../../../src/components/shell/nav.ts";
import ErrorScreen from "../../../../src/components/shell/ErrorScreen.ts";
import { goToSignIn, readSession, type SessionRead } from "../../../../src/client/api.ts";

import { BASE_PATH, nextPath, type Base } from "../bases";
import { internalRoute, publicPage, resolve, routeOf, shellRole } from "../routes";
import { navLabel, useLocale } from "../i18n";
import { isNarrow, withoutShell } from "./ljuska-po-ekranu";
import { HostContext } from "./context";
import { EditorSignOutSlot } from "./editor/save-status/SignOutSlot";
import { RecoveryOffer } from "./editor/save-status/RecoveryOffer";
import ProblemReportHelp from "./ProblemReportHelp";
import SignOut from "./SignOut";
import { StudentToasts } from "./student/toast/StudentToasts";
import { NoRoleScreen } from "./signin/SignInScreen";
import ShellNotifications from "./shell/notifications/ShellNotifications";
import { shellMessagesFor } from "./teacher/shell/messages";

/**
 * The institution front (#2028 c.6993786629 §3.3), as the layout of
 * app/(host)/: reads the session once, sends a signed-out browser to AAI@EduHr
 * sign-in (D-09), and shows the page of the path for the session's role inside
 * the prototypes' shell (VIZ-0: no top bar, so no breadcrumb; the
 * institution's name moves to the side bar's foot). Links of the app open through the
 * Next router, without a reload.
 */
export default function Host({ base, children }: { base: Base; children: ReactNode }) {
  const router = useRouter();
  const route = routeOf(`${BASE_PATH}${usePathname()}`, base);
  const open = publicPage(route);
  const [session, setSession] = useState<SessionRead | null>(null);
  const catalogues = useLocale();
  const { t, app: { host: hostText }, ui, syncFromServer } = catalogues;

  const load = useCallback(() => {
    setSession(null);
    void readSession().then((read) => {
      if (read.kind === "signedOut") goToSignIn(appHref(base, routeOf(window.location.pathname, base)));
      setSession(read);
    });
  }, [base]);
  // A public page reads no session; leaving it for a page of the shell reads it.
  const isPublic = open !== null;
  useEffect(() => {
    if (!isPublic) load();
  }, [load, isPublic]);

  const navigate = useCallback((to: string, replace = false) => {
    if (replace) router.replace(nextPath(base, to));
    else router.push(nextPath(base, to));
  }, [base, router]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (anchor === null || anchor.hasAttribute("download") || (anchor.getAttribute("target") ?? "_self") !== "_self") return;
      const to = internalRoute(anchor.getAttribute("href") ?? "", base);
      if (to === null) return;
      event.preventDefault();
      navigate(to);
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [base, navigate]);

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

  useEffect(() => {
    const shown = open ?? (resolved?.kind === "page" ? resolved.page : null);
    const page = shown === null ? null : navLabel(shown, role, { ...catalogues, t: shellMessagesFor(t, role) });
    // WCAG 2.4.2: a path no page has keeps a title of its own too, the error's heading.
    const heading = page ?? (resolved?.kind === "notFound" ? t.errorPage.notFoundTitle : null);
    const title = heading === null ? t.app.name : `${heading} · ${t.app.name}`;
    // WCAG 2.4.2 (WEB-1805): Next streams the root layout's title after hydration on
    // public pages and on pages with async params, and would put back the bare app name.
    const keep = () => {
      if (document.title !== title) document.title = title;
    };
    keep();
    const watch = new MutationObserver(keep);
    watch.observe(document.head, { childList: true, subtree: true, characterData: true });
    return () => watch.disconnect();
  }, [open, resolved, role, catalogues, t]);

  if (open !== null) return <HostContext value={{ base, page: open, role: null }}>{children}</HostContext>;

  if (session === null) return <RouteLoading label={hostText.loading} />;
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
          homeLabel={ui.sideShell.home[role ?? "none"]}
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
