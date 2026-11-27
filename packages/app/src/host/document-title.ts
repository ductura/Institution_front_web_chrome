import { useEffect } from "react";

import type { ShellRole } from "../../../../src/components/shell/nav.ts";

import type { Page } from "../routes";
import { navLabel, useLocale } from "../i18n";
import { shellMessagesFor } from "./teacher/shell/messages";
import { documentTitle } from "./states/document-title";
import { headingFor } from "./page-title";

/**
 * The document's title for the page shown (WCAG 2.4.2): the page's name and the
 * app's (WEB-NASLOVI-SVE: a page's own `detail` wins), the error's heading on a path no page has, else the app's name alone.
 * Shared by the public pages and the signed-in shell (DAN-1571).
 */
export function useDocumentTitle(shown: Page | null, role: ShellRole | null, notFound: boolean, detail: string | null = null): void {
  const catalogues = useLocale();
  const { t } = catalogues;
  useEffect(() => {
    const page = shown === null ? null : navLabel(shown, role, { ...catalogues, t: shellMessagesFor(t, role) });
    // WCAG 2.4.2: a path no page has keeps a title of its own too, the error's heading.
    const heading = headingFor(shown?.path ?? null, page) ?? (notFound ? t.errorPage.notFoundTitle : null);
    const title = documentTitle(detail ?? heading, t.app.name);
    // WCAG 2.4.2 (WEB-1805): Next streams the root layout's title after hydration on
    // public pages and on pages with async params, and would put back the bare app name.
    const keep = () => {
      if (document.title !== title) document.title = title;
    };
    keep();
    const watch = new MutationObserver(keep);
    watch.observe(document.head, { childList: true, subtree: true, characterData: true });
    return () => watch.disconnect();
  }, [shown, notFound, role, catalogues, t, detail]);
}
