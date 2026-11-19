"use client";

import "@ductura/ui/fonts.css";
import "@ductura/ui/tokens.css";

import { readTheme } from "@ductura/ui";
import { useLayoutEffect } from "react";

import ErrorScreen from "../../../src/components/shell/ErrorScreen.ts";
import { messagesHr as t } from "../../../locales/hr.ts";

// From Ductus src/app/global-error.tsx (#732 item 3): an error in the root
// layout replaces the whole document, so this page brings its own <html> in
// Croatian, the fonts, the tokens and the kept theme (dark by default, D-188).
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useLayoutEffect(() => {
    let storage: Storage | undefined;
    try {
      storage = window.localStorage;
    } catch {
      // Storage blocked: the page stays dark.
    }
    document.documentElement.setAttribute("data-theme", readTheme(storage));
  }, []);
  return (
    <html lang="hr" data-theme="dark" suppressHydrationWarning>
      <body>
        <title>{`${t.errorPage.errorTitle} · ${t.app.name}`}</title>
        <ErrorScreen title={t.errorPage.errorTitle} body={t.errorPage.errorBody} onRetry={reset} />
      </body>
    </html>
  );
}
