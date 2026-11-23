"use client";

// PIL-K-IZJAVA-VRATA: whether steps 3 and 4 may send, read from the server through the declaration
// client (student.declaration.get), never from this browser: neither its storage nor the address step 2 hands over.
// A failed read keeps sending closed (PRODUCT §5 rule 11); the server checks again on submission.
import { useCallback, useEffect, useRef, useState } from "react";

import { createApi } from "../../../../../../../src/client/api.ts";
import { readDeclarationGate, type DeclarationGate } from "../../../../../../../src/client/declaration.ts";

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
