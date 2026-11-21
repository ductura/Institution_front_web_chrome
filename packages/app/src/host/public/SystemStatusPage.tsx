"use client";

import { appHref } from "@/components/shell/nav";
import NoticesView from "@/components/status/NoticesView";
import StatusBoard from "@/components/status/StatusBoard";
import { STATUS_NOTICES } from "@/lib/status/public-notices";
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
      <NoticesView notices={STATUS_NOTICES} now={Date.now()} />
    </main>
  );
}
