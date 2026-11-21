import type { ConfirmResult, ImportConfirmed, ImportPermission, ImportPreview, PreviewResult } from "../../../../../../src/client/import.ts";

import { importHostHr as t } from "./messages.hr";

/** The import dialog as a small state machine: file → preview → confirmed, never text before the student confirms. */
export type ImportState =
  | { step: "choose"; error?: string }
  | { step: "reading" }
  | { step: "preview"; preview: ImportPreview; declared: boolean; error?: string }
  | { step: "confirming"; preview: ImportPreview }
  | { step: "done"; confirmed: ImportConfirmed };

export const START: ImportState = { step: "choose" };

/** The button exists only on an explicit "allowed" (M8.2b criterion 1). */
export const showImportButton = (permission: ImportPermission | null): boolean => permission?.kind === "allowed";

const message = (kind: "notAllowed" | "signedOut" | "expired" | "unavailable") => t[kind];

export function afterPreview(result: PreviewResult): ImportState {
  if (result.kind === "preview") return { step: "preview", preview: result.preview, declared: false };
  if (result.kind === "refused") return { step: "choose", error: t.refused[result.reason] };
  return { step: "choose", error: message(result.kind) };
}

export const declare = (state: ImportState, declared: boolean): ImportState =>
  state.step === "preview" ? { ...state, declared, error: undefined } : state;

/** Confirm needs the preview on screen and the declaration ticked. */
export const canConfirm = (state: ImportState): state is Extract<ImportState, { step: "preview" }> =>
  state.step === "preview" && state.declared;

export function afterConfirm(state: ImportState, result: ConfirmResult): ImportState {
  if (state.step !== "confirming") return state;
  if (result.kind === "confirmed") return { step: "done", confirmed: result.confirmed };
  if (result.kind === "expired") return { step: "choose", error: t.expired };
  return { step: "preview", preview: state.preview, declared: true, error: message(result.kind) };
}
