// NF-3 PR-5 (PD-10, R-56): what steps 3 and 4 offer beside an unconfirmed declaration. The dialog opens
// for a declaration the server holds as missing; a confirmation for an earlier revision of the text
// (stale) is offered as "Potvrdi izjavu ponovno", anything else missing as "Otvori izjavu".
import { declarationDetailOf } from "../../../../../../../src/client/declaration.ts";
import type { GateState } from "../summary/declaration-gate";
import { declarationStepText as t } from "./messages.hr";

/** Whether the server holds a confirmation the text has since outgrown. */
export function isStale(gate: GateState): boolean {
  return gate.kind === "missing" && declarationDetailOf(gate) === "stale";
}

/** The button that opens the dialog, or null when there is nothing to declare or confirm. */
export function dialogOpener(gate: GateState): string | null {
  if (gate.kind !== "missing") return null;
  return isStale(gate) ? t.reconfirm : t.openDialog;
}

/** The dialog's title and openers, for the steps that open it and their tests. */
export const dialogTexts = { title: t.title, open: t.openDialog, reconfirm: t.reconfirm, again: t.confirmAgain, stale: t.staleNotice } as const;
