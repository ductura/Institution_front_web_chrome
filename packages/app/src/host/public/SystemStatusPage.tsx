"use client";

import { useEffect, useState } from "react";

import { appHref } from "@/components/shell/nav";
import NoticesView from "@/components/status/NoticesView";
import StatusBoard from "@/components/status/StatusBoard";
import { STATUS_NOTICES } from "@/lib/status/public-notices";
import { messagesHr as t } from "../../../../../locales/hr.ts";

import { useHost } from "../context";

export default function SystemStatusPage() {
  const { base } = useHost();
  // Re-read the clock so a finished maintenance window leaves the list without a reload.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);

  return (
    <main id="sadrzaj" tabIndex={-1} className="page">
      <header>
        <a href={appHref(base, "/")}>{t.app.name}</a>
        <h1>{t.statusPage.title}</h1>
        <p>{t.statusPage.intro}</p>
      </header>
      <StatusBoard />
      <NoticesView notices={STATUS_NOTICES} now={now} />
    </main>
  );
}
