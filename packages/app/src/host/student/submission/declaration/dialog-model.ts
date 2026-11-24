// NF-3 PR-5 (PD-10, R-56): what steps 3 and 4 offer beside an unconfirmed declaration. The dialog opens
// for a declaration the server holds as missing; a confirmation for an earlier revision of the text
// (stale) is offered as "Potvrdi izjavu ponovno", anything else missing as "Otvori izjavu".
import { useEffect, useRef, type RefObject } from "react";

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

/**
 * The label of the button that opens the dialog, as the step shows it: while the gate is read again (after the dialog closes) the last one
 * stays, so the shared Dialog can hand the focus back to the very button that opened it.
 */
export function useOpener(gate: GateState): string | null {
  const last = useRef<string | null>(null);
  if (gate.kind !== "loading") last.current = dialogOpener(gate);
  return last.current;
}

/** Once the dialog has confirmed and its button is gone, the focus goes to the step's next action, not the page. */
export function useFocusAfterDialog(open: boolean, declareLabel: string | null, next: RefObject<HTMLElement | null>): void {
  const wasOpen = useRef(false);
  useEffect(() => {
    if (open) { wasOpen.current = true; return; }
    if (!wasOpen.current || declareLabel !== null) return;
    wasOpen.current = false;
    if (document.activeElement === null || document.activeElement === document.body) next.current?.focus();
  }, [open, declareLabel, next]);
}
