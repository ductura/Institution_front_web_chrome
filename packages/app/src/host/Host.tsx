"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type ReactNode } from "react";

import { RouteLoading } from "@ductura/ui";

import { AppShell, appHref } from "../../../../src/components/index.ts";
import ErrorScreen from "../../../../src/components/shell/ErrorScreen.ts";
import { messagesHr as t } from "../../../../locales/hr.ts";
import { goToSignIn, readSession, type SessionRead } from "../../../../src/client/api.ts";

import type { Base } from "../bases";
import { crumbsOf, internalRoute, resolve, routeOf, shellRole } from "../routes";
import { hostText } from "../text";
import { HostContext } from "./context";
import SignOut from "./SignOut";

/** Next's path of an app route: the browser's path without the basePath "/app". */
function nextPath(base: Base, route: string): string {
  return appHref(base, route).slice("/app".length);
}

/**
 * The institution front (#2028 c.6993786629 §3.3), as the layout of
 * app/[base]/: reads the session once, sends a signed-out browser to AAI@EduHr
 * sign-in (D-09), and shows the page of the path for the session's role inside
 * the shell, with the institution's name. Links of the app open through the
 * Next router, without a reload.
 */
export default function Host({ base, children }: { base: Base; children: ReactNode }) {
  const router = useRouter();
  const route = routeOf(`/app${usePathname()}`, base);
  const [session, setSession] = useState<SessionRead | null>(null);

  const load = useCallback(() => {
    setSession(null);
    void readSession().then((read) => {
      if (read.kind === "signedOut") goToSignIn(appHref(base, routeOf(window.location.pathname, base)));
      setSession(read);
    });
  }, [base]);
  useEffect(load, [load]);

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
  const resolved = signedIn === null ? null : resolve(route, role);

  useEffect(() => {
    if (resolved?.kind === "redirect") navigate(resolved.to, true);
  }, [resolved, navigate]);

  useEffect(() => {
    const page = resolved?.kind === "page" ? resolved.page.label : null;
    document.title = page === null ? t.app.name : `${page} · ${t.app.name}`;
  }, [resolved]);

  if (session === null) return <RouteLoading label={hostText.loading} />;
  if (session.kind === "signedOut") return <RouteLoading label={hostText.signingIn} />;
  if (session.kind === "unavailable") {
    return <ErrorScreen title={hostText.sessionUnavailableTitle} body={hostText.sessionUnavailable} onRetry={load} />;
  }
  if (resolved === null || resolved.kind === "redirect") return <RouteLoading label={hostText.loading} />;

  const shell = (current: string | undefined, crumbs: readonly string[], body: ReactNode, ownMain = false) => (
    <AppShell
      role={role}
      scope={null}
      current={current}
      crumbs={crumbs}
      base={base}
      institution={signedIn?.institution ?? null}
      account={<SignOut />}
      ownMain={ownMain}
    >
      {body}
    </AppShell>
  );

  if (resolved.kind === "notFound") {
    return shell(undefined, [t.errorPage.notFoundTitle], <ErrorScreen title={t.errorPage.notFoundTitle} body={t.errorPage.notFoundBody} />, true);
  }
  if (resolved.kind === "noRole") {
    return shell(undefined, [], <section className="page"><h1>{t.home.welcome}</h1><p>{hostText.noRole}</p></section>);
  }
  const { page } = resolved;
  return shell(page.current, crumbsOf(page, role), <HostContext value={{ base, page, role }}>{children}</HostContext>);
}
