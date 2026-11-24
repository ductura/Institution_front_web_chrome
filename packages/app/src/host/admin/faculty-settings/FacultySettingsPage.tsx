"use client";

import { ActionRow, Button, Card, Notice, SummaryList } from "@ductura/ui";
import { useCallback, useEffect, useState, type ReactNode } from "react";

import { messagesHr } from "@/lib/i18n/messages.hr";
import { appHref } from "@/components/index";
import { goToSignIn } from "@/client/api";

import { useHost } from "../../context";
import { facultySettingsMessages as t } from "./messages.hr";
import {
  readRetentionPart, readRulesPart, readThresholdsPart, summariseRetention, summariseRules, summariseThresholds, type Part,
} from "./read";

const date = new Intl.DateTimeFormat("hr-HR", { dateStyle: "medium", timeZone: "Europe/Zagreb" });
const origins = messagesHr.facultyRuleVersions.origins;
const refusal = { signedOut: t.signedOut, denied: t.denied, unavailable: t.unavailable } as const;

/** One card over one read; a failed read shows its own error and retry, the other cards stay. */
function Panel<T>({ title, read, link, children }: {
  title: string; read: () => Promise<Part<T>>; link: { path: string; label: string }; children: (value: T) => ReactNode;
}) {
  const { base } = useHost();
  const [part, setPart] = useState<Part<T> | null>(null);
  const load = useCallback(() => {
    setPart(null);
    void read().then(setPart);
    // `read` is a module function, stable across renders.
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(load, [load]);
  useEffect(() => {
    if (part?.kind === "signedOut") goToSignIn(appHref(base, "/ustanova/postavke"));
  }, [part, base]);
  if (part === null) return <Card level={2} title={title} busy />;
  if (part.kind !== "ready") {
    return (
      <>
        <Card level={2} title={title} error={refusal[part.kind]} />
        {part.kind === "unavailable" && <ActionRow><Button tone="secondary" onClick={load}>{t.retry}</Button></ActionRow>}
      </>
    );
  }
  return (
    <Card level={2} title={title}>
      {children(part.value)}
      <p><a href={appHref(base, link.path)}>{link.label}</a></p>
    </Card>
  );
}

/** NF-7 OA-2: the administrator's one place for the faculty's settings; reads only, three cards. */
export default function FacultySettingsPage() {
  const { base } = useHost();
  return (
    <>
      <p>{t.lead}</p>
      <Panel title={t.rules.title} read={readRulesPart} link={{ path: "/ustanova/pravila", label: t.rules.link }}>
        {(rows) => {
          const sum = summariseRules(rows);
          return (
            <>
              <p>{sum.latest === null ? t.rules.none : t.rules.count(sum.published, sum.total)}</p>
              {sum.latest !== null && <p>{t.rules.changed(date.format(new Date(sum.latest.publishedAt)), origins[sum.latest.origin])}</p>}
            </>
          );
        }}
      </Panel>
      <Panel title={t.thresholds.title} read={readThresholdsPart} link={{ path: "/ustanova/pragovi", label: t.thresholds.link }}>
        {(rows) => {
          const sum = summariseThresholds(rows);
          return <p>{sum.set === 0 ? t.thresholds.none : t.thresholds.count(sum.set, sum.total)}</p>;
        }}
      </Panel>
      <Panel title={t.retention.title} read={readRetentionPart} link={{ path: "/ustanova/cuvanje", label: t.retention.link }}>
        {(rows) => {
          const sum = summariseRetention(rows);
          return (
            <SummaryList rows={[
              { id: "count", label: t.retention.title, value: t.retention.count(sum.decided, sum.total) },
              ...(sum.awaiting ? [{ id: "awaiting", label: t.retention.awaiting, value: "" }] : []),
            ]} />
          );
        }}
      </Panel>
      <Notice tone="info">{t.forms.title}: {t.forms.unavailable}</Notice>
      <p><a href={appHref(base, "/ustanova/postavke/asistent")}>{t.assistant.title}</a></p>
    </>
  );
}
