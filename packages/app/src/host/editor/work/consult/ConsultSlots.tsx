"use client";

// WEB-2122 (prototype mentor2, "Konzultacije"): the student asks for a slot and takes the mentor's
// counter-proposal; the teacher confirms or proposes another time. A write that did not save keeps
// the form as typed; a success shows only from the server's answer (B-6). The collaborator only reads.
import { Button } from "@ductura/ui";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  readConsultationSlots, requestConsultationSlot, updateConsultationSlot,
  type ConsultationSlot, type SlotAction, type SlotsApi, type SlotWrite,
} from "../../../../../../../src/client/consultation-slots";

import styles from "./Consult.module.css";
import { IDLE_FORM, actionsFor, afterSlotWrite, lineText, localToIso, slotsHeading, statusText, timeText, withSlot, type Form, type Role } from "./consult-model";
import { consultHr } from "./messages.hr";

const t = consultHr.slots;
type Load = { kind: "loading" } | { kind: "ready"; slots: readonly ConsultationSlot[] } | { kind: "unavailable" | "notFound" | "signedOut" };

export function ConsultSlots({ documentId, role, call, onSessionEnd }: {
  documentId: string; role: Role; call: SlotsApi | null; onSessionEnd?: () => void;
}) {
  const [load, setLoad] = useState<Load>({ kind: "loading" });
  const [request, setRequest] = useState<Form>(IDLE_FORM);
  const [forms, setForms] = useState<Record<string, Form>>({});
  const alive = useRef(true);
  const inFlight = useRef(new Set<string>());
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  const read = useCallback(async () => {
    setLoad({ kind: "loading" });
    if (!call) { setLoad({ kind: "unavailable" }); return; }
    const result = await readConsultationSlots(call, documentId);
    if (!alive.current) return;
    if (result.kind === "ready") setLoad(result);
    else if (result.kind === "session-expired") { setLoad({ kind: "signedOut" }); onSessionEnd?.(); }
    else setLoad({ kind: result.kind === "greska" && result.code === "not_found" ? "notFound" : "unavailable" });
  }, [call, documentId, onSessionEnd]);
  useEffect(() => { void read(); }, [read]);

  const patch = (id: string, next: Partial<Form>) => setForms((all) => ({ ...all, [id]: { ...(all[id] ?? IDLE_FORM), ...next } }));
  const settle = (outcome: SlotWrite) => {
    if (outcome.kind === "saved") setLoad((l) => (l.kind === "ready" ? { kind: "ready", slots: withSlot(l.slots, outcome.slot) } : l));
    if (outcome.kind === "session-expired") onSessionEnd?.();
    if (outcome.kind === "promijenjeno") void read();
  };

  const act = async (slot: ConsultationSlot, action: SlotAction, startsAt?: string) => {
    if (!call || role === "collaborator" || inFlight.current.has(slot.id)) return;
    inFlight.current.add(slot.id);
    patch(slot.id, { busy: true, error: null });
    const outcome = await updateConsultationSlot(call, documentId, slot.id, action, startsAt);
    inFlight.current.delete(slot.id);
    if (!alive.current) return;
    settle(outcome);
    setForms((all) => ({ ...all, [slot.id]: afterSlotWrite(all[slot.id] ?? IDLE_FORM, outcome) }));
  };

  const sendRequest = async () => {
    const iso = localToIso(request.draft);
    if (iso === null) { setRequest((f) => ({ ...f, error: t.needTime })); return; }
    if (!call || role !== "student" || inFlight.current.has("new")) return;
    inFlight.current.add("new");
    setRequest((f) => ({ ...f, busy: true, error: null }));
    const outcome = await requestConsultationSlot(call, documentId, iso);
    inFlight.current.delete("new");
    if (!alive.current) return;
    settle(outcome);
    setRequest((f) => afterSlotWrite(f, outcome));
  };

  if (load.kind === "loading") return <p role="status" className={styles.muted}>{t.loading}</p>;
  if (load.kind !== "ready") {
    const text = load.kind === "signedOut" ? t.errors.signedOut : load.kind === "notFound" ? t.notFound : t.unavailable;
    return (
      <div className={styles.card}>
        <p role="alert" className={styles.error}>{text}</p>
        {load.kind === "unavailable" ? <Button onClick={() => void read()}>{t.retry}</Button> : null}
      </div>
    );
  }
  return (
    <section className={styles.card} aria-labelledby="konzultacije-termini">
      <h3 id="konzultacije-termini">{slotsHeading(load.slots)}</h3>
      {load.slots.length === 0 ? <p className={styles.muted}>{t.empty}</p> : null}
      <ul className={styles.list}>
        {load.slots.map((slot) => {
          const form = forms[slot.id] ?? IDLE_FORM;
          const actions = actionsFor(role, slot);
          return (
            <li key={slot.id} className={styles.item}>
              <b>{statusText(role, slot)}</b>
              <p className={styles.muted}>{lineText(slot)}</p>
              {actions.includes("confirm") ? <Button disabled={form.busy} onClick={() => void act(slot, "confirm")}>{t.confirm}</Button> : null}
              {actions.includes("accept") ? <Button disabled={form.busy} onClick={() => void act(slot, "accept")}>{t.accept.replace("{time}", timeText(slot.startsAt))}</Button> : null}
              {actions.includes("counter") && !form.open ? <Button disabled={form.busy} onClick={() => patch(slot.id, { open: true, error: null })}>{t.propose}</Button> : null}
              {form.open ? (
                <div className={styles.card}>
                  <label>{t.proposeLabel}
                    <input className={styles.field} type="datetime-local" value={form.draft} disabled={form.busy} onChange={(e) => patch(slot.id, { draft: e.target.value })} />
                  </label>
                  <div className={styles.row}>
                    <Button disabled={form.busy} onClick={() => {
                      const iso = localToIso(form.draft);
                      if (iso === null) patch(slot.id, { error: t.needTime }); else void act(slot, "counter", iso);
                    }}>{form.busy ? t.sending : t.proposeSend}</Button>
                    <Button disabled={form.busy} onClick={() => patch(slot.id, { open: false, error: null })}>{t.cancel}</Button>
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
            <label>{t.requestLabel}
              <input className={styles.field} type="datetime-local" value={request.draft} disabled={request.busy} onChange={(e) => setRequest((f) => ({ ...f, draft: e.target.value }))} />
            </label>
            <div className={styles.row}>
              <Button disabled={request.busy} onClick={() => void sendRequest()}>{request.busy ? t.sending : t.requestSend}</Button>
              <Button disabled={request.busy} onClick={() => setRequest(IDLE_FORM)}>{t.cancel}</Button>
            </div>
            {request.error ? <p role="alert" className={styles.error}>{request.error}</p> : null}
          </div>
        ) : <Button onClick={() => setRequest({ ...IDLE_FORM, open: true })}>{t.requestTitle}</Button>
      ) : null}
    </section>
  );
}
