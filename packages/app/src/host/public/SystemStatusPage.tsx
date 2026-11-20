"use client";

import { appHref } from "@/components/shell/nav";
import StatusBoard from "@/components/status/StatusBoard";
import { messagesHr as t } from "../../../../../locales/hr.ts";

import { useHost } from "../context";

export default function SystemStatusPage() {
  const { base } = useHost();

  return (
    <main id="sadrzaj" tabIndex={-1} className="page">
      <header>
        <a href={appHref(base, "/")}>{t.app.name}</a>
        <h1>{t.statusPage.title}</h1>
        <p>{t.statusPage.intro}</p>
      </header>
      <StatusBoard />
    </main>
  );
}
