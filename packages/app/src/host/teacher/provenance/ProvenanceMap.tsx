"use client";

import { useEffect, useState } from "react";
import { Button } from "@ductura/ui";

import { WorkPanel, workPageStyles as styles } from "../n07/WorkPage";

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
  const typedOn = typedShown(switches);
  return (
    <WorkPanel id="km-h" title={t.title} level={2} busy={state.kind === "loading"}>
      <p className="note">{t.intro}</p>
      <p><b>{t.whoTyped}</b></p>
      {ready ? (
        <>
          <label className={styles.switch}>
            <input type="checkbox" data-sw="origin" checked={switches.origin}
              onChange={(event) => onSwitches({ ...switches, origin: event.currentTarget.checked })} /> {t.switchOrigin}
          </label>
          <label className={styles.switch}>
            <input type="checkbox" data-sw="typed" checked={typedOn} disabled={!switches.origin}
              onChange={(event) => onSwitches({ ...switches, typed: event.currentTarget.checked })} /> {t.switchTyped}
          </label>
          <p className="meta">{t.typedHint}</p>
          <ul className={styles.legend} aria-label={t.legendLabel} data-legend>
            {legendItems(switches).map((item) => (
              <li key={item.key} data-mark={item.key}><span className={`${styles.sw} ${styles[item.key]}`} aria-hidden="true" />{item.label}</li>
            ))}
          </ul>
          {state.kind === "noMarks" ? <p className="note">{t.noMarks}</p> : (
            <div data-map-text data-origin={switches.origin ? "on" : "off"} data-typed={typedOn ? "on" : "off"}
              className={`sheet ${styles.paper} ${switches.origin ? "" : styles.off} ${typedOn ? styles.typedOn : ""}`}>
              <p className="note" role="status">{t.textUnavailable}</p>
            </div>
          )}
        </>
      ) : state.kind === "unavailable" ? (
        <>
          <p className="note" role="alert">{t.unavailable}</p>
          <div className={styles.acts}><Button tone="secondary" onClick={onRetry}>{t.retry}</Button></div>
        </>
      ) : state.kind === "notFound" ? <p className="note" role="alert">{t.notFound}</p>
        : state.kind === "signedOut" ? <p className="note" role="alert">{t.signedOut}</p> : null}
    </WorkPanel>
  );
}
