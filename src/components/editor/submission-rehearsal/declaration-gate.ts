"use client";

// WEB-NUZ-PREDAJA-1 (NF-3 PR-2, NF-2 P-11): the one source of the declaration's state for everything
// before the submission. The rehearsal, the workspace's top bar and steps 3 and 4 of the submission all
// read it here, through the declaration client (student.declaration.get), never from this browser:
// neither its storage nor the address step 2 hands over (PIL-K-IZJAVA-VRATA). A failed read keeps
// sending closed (PRODUCT §5 rule 11); the server checks again on submission.
import { useCallback, useEffect, useRef, useState } from "react";

import { createApi } from "../../../client/api";
import { pluralHr } from "../../../lib/i18n/hr";
import { zagrebEpochMs, zagrebWall } from "../../../lib/i18n/zagreb";
import { declarationDetailOf, readDeclarationGate, type DeclarationGate } from "../../../client/declaration";

import { rehearsalMessagesHr as t } from "./messages.hr";

export type GateRead = (assignmentId: string) => Promise<DeclarationGate>;
export type GateState = DeclarationGate | { readonly kind: "loading" };

/** The real read, over createApi. */
export const serverGate: GateRead = (assignmentId) => readDeclarationGate(createApi(), assignmentId);

/** Only the server's answer opens sending: confirmed for this revision, or not asked for. */
export function opensSending(gate: GateState): boolean {
  return gate.kind === "confirmed" || gate.kind === "not_required";
}

/** The gate of one assignment; `reload` reads it again (after a retry or a 409 declaration_required). */
export function useDeclarationGate(assignmentId: string, read: GateRead = serverGate): { readonly gate: GateState; readonly reload: () => void } {
  const [gate, setGate] = useState<GateState>({ kind: "loading" });
  const ticket = useRef(0);
  const reload = useCallback(() => {
    const mine = ++ticket.current;
    setGate({ kind: "loading" });
    void read(assignmentId).then(
      (answer) => { if (mine === ticket.current) setGate(answer); },
      () => { if (mine === ticket.current) setGate({ kind: "unavailable" }); },
    );
  }, [assignmentId, read]);
  useEffect(() => { reload(); return () => { ticket.current += 1; }; }, [reload]);
  return { gate, reload };
}

/** The declaration's state in words (INVENTAR-student E-8 "Izjava", PR-2): the same sentence in the rehearsal and the steps. */
/** "20. 11. 2026. u 11:00" in the faculty's time zone, as the steps write a moment; null when the text is no instant. */
export function atHr(iso: string): string | null {
  const ms = zagrebEpochMs(iso);
  if (ms === null) return null;
  const w = zagrebWall(ms);
  return `${w.day}. ${w.month}. ${w.year}. u ${String(w.hour).padStart(2, "0")}:${String(w.minute).padStart(2, "0")}`;
}

export function declarationText(gate: GateState, at: (iso: string) => string | null = atHr): string {
  if (gate.kind === "loading") return t.declarationChecking;
  if (gate.kind === "unavailable" || gate.kind === "signedOut") return t.declarationUnavailable;
  if (gate.kind === "not_required") return t.declarationNotRequired;
  const detail = declarationDetailOf(gate);
  if (detail === "confirmed") {
    const when = gate.kind === "confirmed" && gate.confirmedAt ? at(gate.confirmedAt) : null;
    return when === null ? t.declarationConfirmed : t.declarationConfirmedAt.replace("{at}", when);
  }
  if (detail === "bound") return t.declarationBound;
  if (detail === "stale") return t.declarationStale;
  if (detail === "draft") return t.declarationDraft;
  return t.declarationNone;
}

/** One thing still to do before the submission, and whether the server refuses the submission without it. */
export type BeforeItem = { readonly id: "declaration" | "places"; readonly text: string; readonly blocks: boolean };

/**
 * "Što još fali" (E-8a, P-17): what is still open before the submission, from the same gate and, where
 * the text is open, the places left for later. Only an unconfirmed declaration stops the submission;
 * places in the text are listed but never hold it (PRODUCT §5). `places` is null where the text is not
 * read (the steps read the server, not the editor).
 */
export function beforeSubmission(gate: GateState, places: number | null): { readonly items: readonly BeforeItem[]; readonly count: number } {
  const items: BeforeItem[] = [];
  if (gate.kind === "missing") items.push({ id: "declaration", text: t.missingDeclaration, blocks: true });
  if (places !== null && places > 0) items.push({ id: "places", text: t.missingPlaces.replace("{count}", String(places)), blocks: false });
  return { items, count: items.length };
}

/** The sentence beside "Predaja rada": "1 stvar prije predaje", "2 stvari prije predaje". */
export function beforeCountText(count: number): string {
  return t.beforeCount.replace("{count}", String(count)).replace("{word}", pluralHr(count, t.thing, t.things, t.things));
}
