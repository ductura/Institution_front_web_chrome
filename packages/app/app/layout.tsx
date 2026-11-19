import "@ductura/ui/fonts.css";
import "@ductura/ui/tokens.css";

import { THEME_KEY } from "@ductura/ui";
import type { Metadata } from "next";
import type { ReactNode } from "react";

import { messagesHr as t } from "../../../locales/hr.ts";

export const metadata: Metadata = {
  title: t.app.name,
  icons: { icon: { url: "/app/web/favicon.svg", type: "image/svg+xml" } },
};

// Dark by default (D-188); a kept light choice is set before the body is
// painted, so it never flashes dark first. Storage may be blocked.
const themeScript =
  `(function(){var e=document.documentElement;` +
  `try{if(localStorage.getItem(${JSON.stringify(THEME_KEY)})==="light")e.setAttribute("data-theme","light")}catch(_){}})();`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="hr" data-theme="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
