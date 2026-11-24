"use client";

import { useSyncExternalStore } from "react";

import { Card } from "@ductura/ui";

import { summaryText } from "./messages.hr";
import { summaryLines, type SummaryInput } from "./summary";

const never = () => () => {};

/** P-8: "Ukratko", five lines above the full notice. The time is the browser's, empty until mounted so server and client agree. */
export default function NoticeSummary({ view }: { view: SummaryInput }) {
  const inBrowser = useSyncExternalStore(never, () => true, () => false);
  const lines = summaryLines(view, (iso) => (inBrowser ? new Date(iso).toLocaleString("hr-HR", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Zagreb" }) : "…"));
  return (
    <Card title={summaryText.heading} level={2}>
      <ul>{lines.map((line) => <li key={line}>{line}</li>)}</ul>
    </Card>
  );
}
