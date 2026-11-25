"use client";

import { Button, Checkbox, Select } from "@ductura/ui";
import { useState } from "react";

import type { AnalysisCatalogue } from "../api/read";
import type { AnalysisRequest } from "../api/run";
import { buildRequest, eligibleColumns, type Built, type Dataset } from "./build-request";
import { analysisTitles, chooseMessages as t, type AnalysisId } from "./messages.hr";

/** The sentence under a disabled "Izračunaj"; `null` when the choice can be sent. */
export function reasonText(built: Built): string | null {
  if (built.ok) return null;
  const text: string = t.reasons[built.reason];
  switch (built.reason) {
    case "tooFew": return text.replace("{min}", String(built.min)).replace("{count}", String(built.count));
    case "tooMany": return text.replace("{max}", String(built.max)).replace("{count}", String(built.count));
    case "wrongKind": return text.replace("{name}", built.name);
    default: return text;
  }
}

/** Ticking a box: a name is added or removed; the result is a new list, the old one is left alone. */
export function toggle(selected: readonly string[], name: string): string[] {
  return selected.includes(name) ? selected.filter((entry) => entry !== name) : [...selected, name];
}

export type ChooseAnalysisProps = {
  catalogue: AnalysisCatalogue;
  dataset: Dataset;
  /** Called with a request the contract takes; never with a refused choice. */
  onChoose: (request: AnalysisRequest) => void;
  busy?: boolean;
};

export function ChooseAnalysis({ catalogue, dataset, onChoose, busy = false }: ChooseAnalysisProps) {
  const [analysisId, setAnalysisId] = useState<AnalysisId | "">("");
  const [selected, setSelected] = useState<string[]>([]);
  const spec = catalogue.analyses.find((entry) => entry.id === analysisId);
  const built: Built = analysisId === "" ? { ok: false, reason: "noAnalysis" } : buildRequest(dataset, { analysisId, variables: selected }, catalogue);
  const reason = reasonText(built);
  const eligible = spec === undefined ? [] : eligibleColumns(dataset, spec);
  const options = catalogue.analyses.map((entry) => ({ value: entry.id, label: analysisTitles[entry.id].title }));
  return (
    <section aria-labelledby="choose-heading">
      <h2 id="choose-heading">{t.heading}</h2>
      <Select label={t.analysis} placeholder={t.analysisPlaceholder} options={options} value={analysisId}
        hint={analysisId === "" ? undefined : analysisTitles[analysisId].note}
        onChange={(event) => {
          const value = event.target.value;
          setAnalysisId(catalogue.analyses.some((entry) => entry.id === value) ? (value as AnalysisId) : "");
          setSelected([]);
        }} />
      {spec !== undefined && (
        <fieldset>
          <legend>{t.variables}</legend>
          <p>{t.variablesHint}</p>
          {eligible.length === 0 && <p role="status">{t.noEligible}</p>}
          {eligible.map((column) => (
            <Checkbox key={column.name} label={`${column.name} (${column.kind === "numeric" ? t.numeric : t.category})`}
              checked={selected.includes(column.name)} onChange={() => setSelected((current) => toggle(current, column.name))} />
          ))}
        </fieldset>
      )}
      <Button disabled={!built.ok || busy} busy={busy} aria-describedby={reason === null ? undefined : "choose-reason"}
        onClick={() => { if (built.ok) onChoose(built.request); }}>{t.submit}</Button>
      {reason !== null && <p id="choose-reason" role="status">{reason}</p>}
    </section>
  );
}
