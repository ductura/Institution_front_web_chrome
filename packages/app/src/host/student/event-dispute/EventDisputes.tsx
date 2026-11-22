"use client";

import { EventDispute } from "@ductura/ui";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { goToSignIn } from "../../../../../../src/client/api";
import type { EventDispute as DisputeRow, EventDisputesPort } from "../../../../../../src/client/event-disputes";
import { eventDisputeText as text } from "./messages.hr";
import { DISPUTE_MAX, eventDisputeLabels, loadOf, marksOf, sendDispute, type DisputeLoad } from "./model";

type Value = {
  readonly port: EventDisputesPort;
  readonly documentId: string;
  readonly load: DisputeLoad;
  readonly add: (row: DisputeRow) => void;
};

const Disputes = createContext<Value | null>(null);

/**
 * Reads the supplements and disputes of one work once (`GET .../event-disputes`) for every
 * event of its process summary (WEB-1305, M7.8). A failed read is said once, and the events and
 * their descriptions stay as they are.
 */
export function EventDisputesProvider({ port, documentId, children }: { port: EventDisputesPort; documentId: string; children: ReactNode }) {
  const [load, setLoad] = useState<DisputeLoad>({ kind: "loading" });
  useEffect(() => {
    let live = true;
    setLoad({ kind: "loading" });
    port.list(documentId).then((outcome) => {
      if (!live) return;
      const next = loadOf(outcome);
      if (next.kind === "signedOut") goToSignIn(window.location.pathname);
      else setLoad(next);
    }, () => { if (live) setLoad({ kind: "error" }); });
    return () => { live = false; };
  }, [port, documentId]);
  const add = useCallback((row: DisputeRow) => {
    setLoad((current) => (current.kind === "ready" ? { kind: "ready", disputes: [...current.disputes, row] } : current));
  }, []);
  const value = useMemo(() => ({ port, documentId, load, add }), [port, documentId, load, add]);
  return (
    <Disputes.Provider value={value}>
      {load.kind === "error" ? <p role="status">{text.loadError}</p> : null}
      {children}
    </Disputes.Provider>
  );
}

/**
 * Under one event: its marks and, for the student, the two actions. The teacher sees the marks
 * and no action. Nothing here changes the event's description.
 */
export function EventDisputeSlot({ eventId, role }: { eventId: string; role: "student" | "teacher" }) {
  const ctx = useContext(Disputes);
  if (ctx === null) throw new Error("EventDisputeSlot needs EventDisputesProvider");
  const { port, documentId, load, add } = ctx;
  const marks = load.kind === "ready" ? marksOf(load.disputes, eventId) : [];
  // Without a read the student can still write: the answer to the send says what happened.
  const canAct = role === "student" && load.kind !== "loading";
  return (
    <EventDispute labels={eventDisputeLabels} marks={marks} canAct={canAct} max={DISPUTE_MAX}
      onSubmit={async (kind, body) => {
        const outcome = await sendDispute(port, documentId, eventId, kind, body);
        if (outcome.kind === "ok") add(outcome.dispute);
        if (outcome.kind === "signedOut") goToSignIn(window.location.pathname);
        return outcome.kind;
      }} />
  );
}
