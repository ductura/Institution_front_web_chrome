"use client";

/**
 * Consultation slots in the Mentor card (WEB-1108; E 3.5 mentor2). The student
 * asks for a slot and accepts the teacher's counter-proposal; the teacher
 * confirms a request or proposes another time. Both sides read the same list,
 * so a confirmed slot is the same for both. A write that failed (a network
 * error included) leaves the form as it was typed, with the reason; a success
 * is shown only from the server's answer. Text is rendered as React text.
 */

import { Button } from "@ductura/ui";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  readConsultationSlots, requestConsultationSlot, updateConsultationSlot,
  type ConsultationSlot, type SlotAction, type SlotsCall, type SlotWrite,
} from "@/client/consultation-slots";

import styles from "./ConsultationSlots.module.css";
import {
  IDLE_FORM, actionsFor, afterWrite, headingText, lineText, localToIso, statusText, timeText, withSlot,
  type Form, type Role,
} from "./slots-logic";
import { consultationSlotsHr as t } from "./messages.hr";

export type SlotsLoad =
  | { readonly kind: "loading" }
  | { readonly kind: "ready"; readonly slots: readonly ConsultationSlot[] }
  | { readonly kind: "unavailable" | "notFound" | "signedOut" };

export function SlotsView({ load, role, request, forms, onRequestOpen, onRequestDraft, onRequestSend, onRequestCancel,
  onAct, onProposeDraft, onProposeSend, onProposeCancel, onRetry }: {
  load: SlotsLoad;
  role: Role;
  request: Form;
  forms: Readonly<Record<string, Form>>;
  onRequestOpen: () => void;
  onRequestDraft: (value: string) => void;
  onRequestSend: () => void;
  onRequestCancel: () => void;
  onAct: (slot: ConsultationSlot, action: SlotAction) => void;
  onProposeDraft: (slot: ConsultationSlot, value: string) => void;
  onProposeSend: (slot: ConsultationSlot) => void;
  onProposeCancel: (slot: ConsultationSlot) => void;
  onRetry: () => void;
}) {
  if (load.kind === "loading") return <p role="status" className={styles.muted}>{t.loading}</p>;
  if (load.kind !== "ready") {
    const text = load.kind === "signedOut" ? t.errors.signedOut : load.kind === "notFound" ? t.notFound : t.unavailable;
    return (
      <div className={styles.card}>
        <p role="alert" className={styles.error}>{text}</p>
        {load.kind === "unavailable" ? <Button onClick={onRetry}>{t.retry}</Button> : null}
      </div>
    );
  }
  return (
    <section className={styles.card} aria-labelledby="konzultacije-termini">
      <h2 id="konzultacije-termini">{headingText(load.slots)}</h2>
      {load.slots.length === 0 ? <p className={styles.muted}>{t.empty}</p> : null}
      <ul className={styles.list}>
        {load.slots.map((slot) => {
          const form = forms[slot.slotId] ?? IDLE_FORM;
          const actions = actionsFor(role, slot);
          return (
            <li key={slot.slotId} className={styles.item}>
              <b>{statusText(role, slot)}</b>
              <p className={styles.muted}>{lineText(slot)}</p>
              {actions.includes("confirm") ? <Button disabled={form.busy} onClick={() => onAct(slot, "confirm")}>{t.confirm}</Button> : null}
              {actions.includes("accept") ? (
                <Button disabled={form.busy} onClick={() => onAct(slot, "accept")}>{t.accept.replace("{time}", timeText(slot.startsAt))}</Button>
              ) : null}
              {actions.includes("propose") && !form.open ? (
                <Button disabled={form.busy} onClick={() => onProposeDraft(slot, form.draft)}>{t.propose}</Button>
              ) : null}
              {form.open ? (
                <div className={styles.card}>
                  <label>
                    {t.proposeLabel}
                    <input className={styles.field} type="datetime-local" value={form.draft} disabled={form.busy}
                      onChange={(e) => onProposeDraft(slot, e.target.value)} />
                  </label>
                  <div className={styles.row}>
                    <Button disabled={form.busy} onClick={() => onProposeSend(slot)}>{form.busy ? t.sending : t.proposeSend}</Button>
                    <Button disabled={form.busy} onClick={() => onProposeCancel(slot)}>{t.cancel}</Button>
                  </div>
                </div>
              ) : null}
              {form.error ? <p role="alert" className={styles.error}>{form.error}</p> : null}
            </li>
          );
        })}
      </ul>
      {role === "student" ? (
        request.open ? (
          <div className={styles.card}>
            <label>
              {t.requestLabel}
              <input className={styles.field} type="datetime-local" value={request.draft} disabled={request.busy}
                onChange={(e) => onRequestDraft(e.target.value)} />
            </label>
            <div className={styles.row}>
              <Button disabled={request.busy} onClick={onRequestSend}>{request.busy ? t.sending : t.requestSend}</Button>
              <Button disabled={request.busy} onClick={onRequestCancel}>{t.cancel}</Button>
            </div>
            {request.error ? <p role="alert" className={styles.error}>{request.error}</p> : null}
          </div>
        ) : (
          <Button onClick={onRequestOpen}>{t.requestTitle}</Button>
        )
      ) : null}
    </section>
  );
}

export default function ConsultationSlots({ documentId, role, call, onSessionEnd }: {
  documentId: string;
  role: Role;
  /** Without a transport (TODO(ugovor)) the card says the slots are unavailable. */
  call: SlotsCall | null;
  onSessionEnd?: () => void;
}) {
  const [load, setLoad] = useState<SlotsLoad>({ kind: "loading" });
  const [request, setRequest] = useState<Form>(IDLE_FORM);
  const [forms, setForms] = useState<Record<string, Form>>({});
  const alive = useRef(true);
  const inFlight = useRef(new Set<string>());
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  const read = useCallback(async () => {
    if (!call) { setLoad({ kind: "unavailable" }); return; }
    const result = await readConsultationSlots(call, documentId);
    if (!alive.current) return;
    if (result.kind === "ready") setLoad(result);
    else if (result.kind === "session-expired") { setLoad({ kind: "signedOut" }); onSessionEnd?.(); }
    else setLoad({ kind: result.kind === "greska" && result.code === "not_found" ? "notFound" : "unavailable" });
  }, [call, documentId, onSessionEnd]);
  useEffect(() => { setLoad({ kind: "loading" }); void read(); }, [read]);

  const patch = (id: string, next: Partial<Form>) => setForms((all) => ({ ...all, [id]: { ...(all[id] ?? IDLE_FORM), ...next } }));

  /** After any write: the server's slot enters the list; a changed slot re-reads it; the form keeps its draft on failure. */
  const settle = (outcome: SlotWrite) => {
    if (outcome.kind === "saved") setLoad((l) => (l.kind === "ready" ? { kind: "ready", slots: withSlot(l.slots, outcome.slot) } : l));
    if (outcome.kind === "session-expired") onSessionEnd?.();
    if (outcome.kind === "promijenjeno") void read();
  };

  const act = async (slot: ConsultationSlot, action: SlotAction, startsAt?: string) => {
    const id = slot.slotId;
    if (!call || inFlight.current.has(id)) return;
    inFlight.current.add(id);
    patch(id, { busy: true, error: null });
    const outcome = await updateConsultationSlot(call, documentId, id, action, startsAt);
    inFlight.current.delete(id);
    if (!alive.current) return;
    settle(outcome);
    setForms((all) => ({ ...all, [id]: afterWrite(all[id] ?? IDLE_FORM, outcome) }));
  };

  const sendRequest = async () => {
    const iso = localToIso(request.draft);
    if (iso === null) { setRequest((f) => ({ ...f, error: t.needTime })); return; }
    if (!call || inFlight.current.has("new")) return;
    inFlight.current.add("new");
    setRequest((f) => ({ ...f, busy: true, error: null }));
    const outcome = await requestConsultationSlot(call, documentId, iso);
    inFlight.current.delete("new");
    if (!alive.current) return;
    settle(outcome);
    setRequest((f) => afterWrite(f, outcome));
  };

  const sendProposal = (slot: ConsultationSlot) => {
    const iso = localToIso(forms[slot.slotId]?.draft ?? "");
    if (iso === null) patch(slot.slotId, { error: t.needTime });
    else void act(slot, "propose", iso);
  };

  return (
    <SlotsView load={load} role={role} request={request} forms={forms} onRetry={() => { setLoad({ kind: "loading" }); void read(); }}
      onRequestOpen={() => setRequest({ ...IDLE_FORM, open: true })}
      onRequestDraft={(value) => setRequest((f) => ({ ...f, draft: value }))}
      onRequestSend={() => void sendRequest()}
      onRequestCancel={() => setRequest(IDLE_FORM)}
      onAct={(slot, action) => void act(slot, action)}
      onProposeDraft={(slot, value) => patch(slot.slotId, { open: true, draft: value, error: null })}
      onProposeSend={sendProposal}
      onProposeCancel={(slot) => patch(slot.slotId, { open: false, error: null })} />
  );
}
