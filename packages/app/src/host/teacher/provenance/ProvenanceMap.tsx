"use client";

import { useEffect, useState } from "react";
import { Button, Card, Checkbox } from "@ductura/ui";

import { provenanceText as t } from "./messages.hr";
import { DEFAULT_SWITCHES, legendItems, typedShown, type MapSwitches, type ProvenanceState } from "./model";
import { readProvenance, type ProvenanceCall } from "./read";

/**
 * "Karta podrijetla" of one work (WEB-2158; N-10 km-h; ODGOVORI B-1, B-2). The switches only change what this
 * screen shows, never the record, so a co-teacher with read access uses them as well. The marked text of the
 * work needs a server read that the contract extract does not have yet; until then the map says so instead of
 * guessing where the marks are.
 */
export default function ProvenanceMap({ documentId, call = readProvenance }: { documentId: string; call?: ProvenanceCall }) {
  const [state, setState] = useState<ProvenanceState>({ kind: "loading" });
  const [switches, setSwitches] = useState<MapSwitches>(DEFAULT_SWITCHES);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setState({ kind: "loading" });
    void call(documentId).then((read) => { if (active) setState(read); });
    return () => { active = false; };
  }, [call, documentId, attempt]);
  return <ProvenanceMapView state={state} switches={switches} onSwitches={setSwitches} onRetry={() => setAttempt((n) => n + 1)} />;
}

export function ProvenanceMapView({ state, switches, onSwitches, onRetry }: {
  state: ProvenanceState; switches: MapSwitches; onSwitches: (next: MapSwitches) => void; onRetry: () => void;
}) {
  const ready = state.kind === "marked" || state.kind === "noMarks";
  return (
    <Card title={t.title} busy={state.kind === "loading"}>
      <p>{t.intro}</p>
      <p><strong>{t.whoTyped}</strong></p>
      {ready ? (
        <>
          <Checkbox label={t.switchOrigin} data-sw="origin" checked={switches.origin}
            onChange={(event) => onSwitches({ ...switches, origin: event.currentTarget.checked })} />
          <Checkbox label={t.switchTyped} data-sw="typed" hint={t.typedHint} checked={typedShown(switches)}
            disabled={!switches.origin} onChange={(event) => onSwitches({ ...switches, typed: event.currentTarget.checked })} />
          <ul aria-label={t.legendLabel} data-legend>
            {legendItems(switches).map((item) => <li key={item.key} data-mark={item.key}>{item.label}</li>)}
          </ul>
          {state.kind === "noMarks" ? <p>{t.noMarks}</p> : (
            <div data-map-text data-origin={switches.origin ? "on" : "off"} data-typed={typedShown(switches) ? "on" : "off"}>
              <p role="status">{t.textUnavailable}</p>
            </div>
          )}
        </>
      ) : state.kind === "unavailable" ? (
        <>
          <p role="alert">{t.unavailable}</p>
          <Button onClick={onRetry}>{t.retry}</Button>
        </>
      ) : state.kind === "notFound" ? <p role="alert">{t.notFound}</p>
        : state.kind === "signedOut" ? <p role="alert">{t.signedOut}</p> : null}
    </Card>
  );
}
