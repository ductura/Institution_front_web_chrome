"use client";

import { usePathname, useRouter } from "next/navigation";
import { lazy, Suspense, useCallback, useEffect, type ReactNode } from "react";

import { RouteLoading } from "@ductura/ui";

import { nextPath, type Base } from "../bases";
import { internalRoute, publicPage, routeOf, type Page } from "../routes";
import { useLocale } from "../i18n";
import { HostContext } from "./context";
import { useDocumentTitle } from "./document-title";

// DAN-1571: the shell, the session and the editor's parts load only off the public pages.
const SignedInHost = lazy(() => import("./SignedInHost"));

/**
 * The institution front (#2028 c.6993786629 §3.3), as the layout of
 * app/[base]/: a public page shows as it is, with no session read; any other
 * path goes to the signed-in host (SignedInHost.tsx). Links of the app open
 * through the Next router, without a reload.
 */
export default function Host({ base, children }: { base: Base; children: ReactNode }) {
  const router = useRouter();
  const route = routeOf(`/app${usePathname()}`, base);
  const open = publicPage(route);
  const { app: { host: hostText } } = useLocale();

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

  if (open !== null) return <PublicPage base={base} page={open}>{children}</PublicPage>;
  return (
    <Suspense fallback={<RouteLoading label={hostText.loading} />}>
      <SignedInHost base={base} route={route} navigate={navigate}>{children}</SignedInHost>
    </Suspense>
  );
}

function PublicPage({ base, page, children }: { base: Base; page: Page; children: ReactNode }) {
  useDocumentTitle(page, null, false);
  return <HostContext value={{ base, page, role: null }}>{children}</HostContext>;
}
