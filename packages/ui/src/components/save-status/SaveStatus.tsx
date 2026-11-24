import { SaveState } from "../SaveState";
import { saveStateContent, type SaveStateName } from "../save-state";

import { saveStatusHr } from "./messages.hr";

const LABELS: Partial<Record<SaveStateName, string>> = {
  EDITING: saveStatusHr.saving,
  SAVING_LOCAL: saveStatusHr.saving,
  SYNCING: saveStatusHr.saving,
  ERROR: saveStatusHr.unsaved,
};

/**
 * `waiting`: offline only, what waits to be sent ("čeka slanje: 2 izmjene"),
 * after the label. `live` as in SaveState (default true).
 */
export function SaveStatus({ state, blocked, online = true, waiting, live = true }: {
  state: SaveStateName;
  blocked?: boolean;
  online?: boolean;
  waiting?: string;
  live?: boolean;
}) {
  const original = saveStateContent(state, blocked);
  const label = (!blocked && Object.hasOwn(LABELS, state) ? LABELS[state] : undefined) ?? original.text;
  const shown = online ? label : [saveStatusHr.offline, label, ...(waiting ? [waiting] : [])].join(" · ");
  return <SaveState state={state} blocked={blocked} label={shown} live={live} />;
}
