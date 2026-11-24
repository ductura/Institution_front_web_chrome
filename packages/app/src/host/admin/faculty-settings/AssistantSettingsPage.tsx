"use client";

import { ActionRow, Button, Card, DataTable, Notice, SummaryList, type DataTableColumn } from "@ductura/ui";
import { useCallback, useEffect, useState } from "react";

import { messagesHr } from "@/lib/i18n/messages.hr";
import { appHref } from "@/components/index";
import { goToSignIn } from "@/client/api";

import { useHost } from "../../context";
import { facultySettingsMessages as t } from "./messages.hr";
import { assistantRows, readRulesPart, type AssistantRow, type Part } from "./read";
import type { RuleRow } from "../institution-config/rules";

const copy = messagesHr.facultyRuleVersions;
const workTypes = messagesHr.teacher.assignment.workTypes;
const purposes = (row: AssistantRow) =>
  row.version === null ? t.assistant.noRule : row.version.aiPurposes.length === 0 ? t.assistant.none : row.version.aiPurposes.map((p) => copy.purposeLabels[p]).join(", ");

const columns: DataTableColumn<AssistantRow>[] = [
  { id: "type", header: t.assistant.colType, cell: (r) => workTypes[r.workType], rowHeader: true },
  { id: "policy", header: t.assistant.colPolicy, cell: (r) => (r.version === null ? t.assistant.noRule : copy.policies[r.version.aiPolicy]) },
  { id: "purposes", header: t.assistant.colPurposes, cell: purposes },
];

/**
 * NF-7 OA-9: the faculty's assistant settings, read only. The faculty switch is a constant (C15, OC-1: off in phase A),
 * so it is stated, not read; what the rules allow per work type comes from the faculty rules. No provider or model is named.
 */
export default function AssistantSettingsPage() {
  const { base } = useHost();
  const [part, setPart] = useState<Part<readonly RuleRow[]> | null>(null);
  const load = useCallback(() => {
    setPart(null);
    void readRulesPart().then(setPart);
  }, []);
  useEffect(load, [load]);
  useEffect(() => {
    if (part?.kind === "signedOut") goToSignIn(appHref(base, "/ustanova/postavke/asistent"));
  }, [part, base]);

  return (
    <>
      <p>{t.assistant.lead}</p>
      <Card level={2} title={t.assistant.status}>
        <SummaryList rows={[{ id: "state", label: t.assistant.status, value: t.assistant.off }]} />
        <p>{t.assistant.offNote}</p>
        <p>{t.assistant.studentSees}</p>
        <Notice tone="info">{t.assistant.switchUnknown}</Notice>
      </Card>
      {part === null && <Card level={2} title={t.assistant.byTypeHeading} busy />}
      {part !== null && part.kind !== "ready" && (
        <>
          <Card level={2} title={t.assistant.byTypeHeading} error={part.kind === "denied" ? t.denied : part.kind === "signedOut" ? t.signedOut : t.unavailable} />
          {part.kind === "unavailable" && <ActionRow><Button tone="secondary" onClick={load}>{t.retry}</Button></ActionRow>}
        </>
      )}
      {part !== null && part.kind === "ready" && (
        <Card level={2} title={t.assistant.byTypeHeading}>
          <p>{t.assistant.byTypeNote}</p>
          <DataTable caption={t.assistant.byTypeHeading} columns={columns} rows={assistantRows(part.value)} rowKey={(r) => r.workType} empty={t.assistant.noRule} />
          <p>{t.assistant.changeRules}</p>
        </Card>
      )}
      <p><a href={appHref(base, "/ustanova/pravila")}>{t.assistant.link}</a></p>
      <p><a href={appHref(base, "/ustanova/postavke")}>{t.assistant.back}</a></p>
    </>
  );
}
