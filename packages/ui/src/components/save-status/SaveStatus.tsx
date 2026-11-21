import { SaveState } from "../SaveState";
import { saveStateContent, type SaveStateName } from "../save-state";

import { saveStatusHr } from "./messages.hr";

const LABELS: Partial<Record<SaveStateName, string>> = {
  EDITING: saveStatusHr.saving,
  SAVING_LOCAL: saveStatusHr.saving,
  SYNCING: saveStatusHr.saving,
  ERROR: saveStatusHr.unsaved,
};

export function SaveStatus({ state, blocked, online = true }: {
  state: SaveStateName;
  blocked?: boolean;
  online?: boolean;
}) {
  const original = saveStateContent(state, blocked);
  const label = (!blocked && Object.hasOwn(LABELS, state) ? LABELS[state] : undefined) ?? original.text;
  return <SaveState state={state} blocked={blocked} label={online ? label : `${saveStatusHr.offline} · ${label}`} />;
}
