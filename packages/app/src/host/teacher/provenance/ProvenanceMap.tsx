"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Button } from "@ductura/ui";

import { WorkPanel, workPageStyles as styles } from "../n07/WorkPage";

import AssistantMatchSection from "./AssistantMatchSection";
import type { MatchCall } from "./contract";
import MarkedText from "./MarkedText";
import { provenanceText as t } from "./messages.hr";
import { DEFAULT_SWITCHES, legendItems, typedShown, type MapSwitches, type ProvenanceState } from "./model";
import { readProvenance, type ProvenanceCall } from "./read";
import { readMarkedText, type TextCall, type TextState } from "./text-read";

/**
 * "Karta podrijetla" of one work (WEB-2158; N-10 km-h; ODGOVORI B-1, B-2). The switches only change what this
 * screen shows, never the record, so a co-teacher with read access uses them as well. Once the work has marks, the
 * text of the work is read with the ranges of its revision (PG-2, WEB-NF5-KARTA, origin-segments-v1) and drawn
 * with the marks in words; without recorded ranges the map says so instead of guessing where the marks are. The
 * match with an answer of the assistant (P-1 rule 13) is a section of this map (PIL-P1-PODUDARANJE-KARTA); it
 * exists only while the server has a finding or a share of it.
 */
export default function ProvenanceMap({ documentId, call = readProvenance, matchCall, textCall = readMarkedText }: {
  documentId: string; call?: ProvenanceCall; matchCall?: MatchCall; textCall?: TextCall;
}) {
  const [state, setState] = useState<ProvenanceState>({ kind: "loading" });
  const [text, setText] = useState<TextState>({ kind: "loading" });
  const [switches, setSwitches] = useState<MapSwitches>(DEFAULT_SWITCHES);
  const [attempt, setAttempt] = useState(0);
  const [textAttempt, setTextAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setState({ kind: "loading" });
    void call(documentId).then((read) => { if (active) setState(read); });
    return () => { active = false; };
  }, [call, documentId, attempt]);
  const marked = state.kind === "marked";
  useEffect(() => {
    if (!marked) return undefined;
    let active = true;
    setText({ kind: "loading" });
    void textCall(documentId).then((read) => { if (active) setText(read); });
    return () => { active = false; };
  }, [marked, textCall, documentId, textAttempt]);
  return (
    <ProvenanceMapView state={state} switches={switches} onSwitches={setSwitches} onRetry={() => setAttempt((n) => n + 1)}
      text={text} onTextRetry={() => setTextAttempt((n) => n + 1)}>
      <AssistantMatchSection documentId={documentId} call={matchCall} />
    </ProvenanceMapView>
  );
}

const NO_RANGES: TextState = { kind: "noRanges" };
const NOTHING = (): void => {};

/** `children` is the assistant match section; it is drawn only once the map has read the work. */
export function ProvenanceMapView({ state, switches, onSwitches, onRetry, text = NO_RANGES, onTextRetry = NOTHING, children }: {
  state: ProvenanceState; switches: MapSwitches; onSwitches: (next: MapSwitches) => void; onRetry: () => void;
  text?: TextState; onTextRetry?: () => void; children?: ReactNode;
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
          {state.kind === "noMarks" ? <p className="note">{t.noMarks}</p>
            : <MarkedText state={text} origin={switches.origin} typed={typedOn} onRetry={onTextRetry} />}
          {children}
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
