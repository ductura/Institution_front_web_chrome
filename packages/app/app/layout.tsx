import "@ductura/ui/fonts.css";
import "@ductura/ui/tokens.css";

import type { Metadata } from "next";
import type { ReactNode } from "react";

import { messagesHr as t } from "../../../locales/hr.ts";
import { THEME_SCRIPT } from "../../../src/components/shell/theme.ts";

export const metadata: Metadata = {
  title: t.app.name,
  icons: { icon: { url: "/app/web/favicon.svg", type: "image/svg+xml" } },
};

// Dark by default (D-188); a kept light choice is set before the body is
// painted, so it never flashes dark first. Storage may be blocked. The page
// policy (src/middleware.ts, OSN-W4) allows this inline script only by the
// hash of THEME_SCRIPT, so the host uses that exact text.

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="hr" data-theme="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>
        {/* WCAG 2.4.1 (VIZ-WCAG N4): the first Tab stop skips the shell's navigation. */}
        <a className="skip-link" href="#sadrzaj">
          {t.shell.skipToContent}
        </a>
        {children}
      </body>
    </html>
  );
}
