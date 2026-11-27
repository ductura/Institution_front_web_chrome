"use client";

// WEB-2122 (prototype mentor2, "Konzultacije"): the student asks for a slot and takes the mentor's
// counter-proposal; the teacher confirms or proposes another time. A write that did not save keeps
// the form as typed; a success shows only from the server's answer (B-6). The collaborator only reads.
// WEB-NF6-KONZ (MK-3): the topic of a request, every slot with its closing (consultation-slot-details),
// and "Povuci zahtjev", "Odbij" and "Otkaži termin" through work.consultation-slot-close.post.
import { Button, Checkbox, Details, TextArea, TextField } from "@ductura/ui";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  PREPARATION_MAX, REASON_MAX, TOPIC_MAX, closeConsultationSlot, optionalText, readSlotDetails, requestConsultationSlot, requestConsultationSlotWithPreparation, updateConsultationSlot,
  type CloseAction, type CloseWrite, type ConsultationSlot, type SlotAction, type SlotDetail, type SlotsApi, type SlotWrite,
} from "../../../../../../../src/client/consultation-slots";

import styles from "./Consult.module.css";
import {
  IDLE_FORM, NO_ATTACH, actionsFor, afterSlotWrite, asDetail, attachFrom, attachment, closeActionsFor, closeFailure, closingText, lineText, localToIso,
  slotsHeading, statusText, timeText, topicText, withSlot, type Attach, type Closing, type Form, type Role,
} from "./consult-model";
import { consultHr } from "./messages.hr";
import { prepPort } from "../../mentor/prep-port";
import type { PrepInput } from "../../mentor/mentor-model";

const t = consultHr.slots;
type Load = { kind: "loading" } | { kind: "ready"; slots: readonly SlotDetail[] } | { kind: "unavailable" | "notFound" | "signedOut" };
const CLOSE_LABEL: Record<CloseAction, string> = { withdraw: t.withdraw, decline: t.decline, cancel: t.cancelSlot };
const max = (text: string, n: number) => text.replace("{max}", String(n));

export function ConsultSlots({ documentId, role, call, onSessionEnd, now = Date.now, heading: Heading = "h3", composePreparation }: {
  documentId: string; role: Role; call: SlotsApi | null; onSessionEnd?: () => void;
  /** The heading's level where the list is mounted (h2 under a page's h1, h3 inside the Mentor card). */
  heading?: "h2" | "h3";
  /** Composes the preparation to attach to a request (MEN-26); by default the Mentor card's own composition from the work. */
  composePreparation?: () => Promise<PrepInput | null>;
  /** The clock that decides whether a slot still lies ahead (tests pass a fixed one). */
  now?: () => number;
}) {
  const [load, setLoad] = useState<Load>({ kind: "loading" });
  const [request, setRequest] = useState<Form>(IDLE_FORM);
  const [forms, setForms] = useState<Record<string, Form>>({});
  const [closings, setClosings] = useState<Record<string, Closing>>({});
  const [attach, setAttach] = useState<Attach>(NO_ATTACH);
  const [notice, setNotice] = useState<string | null>(null);
  const alive = useRef(true);
  const inFlight = useRef(new Set<string>());
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  const read = useCallback(async () => {
    setLoad({ kind: "loading" });
    if (!call) { setLoad({ kind: "unavailable" }); return; }
    const result = await readSlotDetails(call, documentId);
    if (!alive.current) return;
    if (result.kind === "ready") setLoad(result);
    else if (result.kind === "session-expired") { setLoad({ kind: "signedOut" }); onSessionEnd?.(); }
    else setLoad({ kind: result.kind === "greska" && result.code === "not_found" ? "notFound" : "unavailable" });
  }, [call, documentId, onSessionEnd]);
  useEffect(() => { void read(); }, [read]);

  const patch = (id: string, next: Partial<Form>) => setForms((all) => ({ ...all, [id]: { ...(all[id] ?? IDLE_FORM), ...next } }));
  const place = (saved: SlotDetail | ConsultationSlot) => setLoad((l) => {
    if (l.kind !== "ready") return l;
    const detail = "closing" in saved ? saved : asDetail(saved, l.slots.find((s) => s.id === saved.id));
    return { kind: "ready", slots: withSlot(l.slots, detail) };
  });
  const settle = (outcome: SlotWrite | CloseWrite) => {
    if (outcome.kind === "saved") place(outcome.slot);
    if (outcome.kind === "session-expired") onSessionEnd?.();
    if (outcome.kind === "promijenjeno") void read();
  };

  const act = async (slot: { readonly id: string }, action: SlotAction, startsAt?: string) => {
    if (!call || role === "collaborator" || inFlight.current.has(slot.id)) return;
    inFlight.current.add(slot.id);
    setNotice(null);
    patch(slot.id, { busy: true, error: null });
    const outcome = await updateConsultationSlot(call, documentId, slot.id, action, startsAt);
    inFlight.current.delete(slot.id);
    if (!alive.current) return;
    settle(outcome);
    setForms((all) => ({ ...all, [slot.id]: afterSlotWrite(all[slot.id] ?? IDLE_FORM, outcome) }));
  };

  const closeOpen = (id: string, next: Partial<Closing>) =>
    setClosings((all) => { const was = all[id]; return was ? { ...all, [id]: { ...was, ...next } } : all; });
  const closeShut = (id: string) => setClosings((all) => { const { [id]: _gone, ...rest } = all; return rest; });

  const close = async (slot: SlotDetail) => {
    const form = closings[slot.id];
    if (!form || !call || role === "collaborator" || inFlight.current.has(slot.id)) return;
    const reason = optionalText(form.reason, REASON_MAX);
    if (reason === null) { closeOpen(slot.id, { error: max(t.reasonTooLong, REASON_MAX) }); return; }
    inFlight.current.add(slot.id);
    setNotice(null);
    closeOpen(slot.id, { busy: true, error: null });
    const outcome = await closeConsultationSlot(call, documentId, slot.id, form.action, reason);
    inFlight.current.delete(slot.id);
    if (!alive.current) return;
    if (outcome.kind === "saved") { place(outcome.slot); closeShut(slot.id); setNotice(t.closed[form.action]); return; }
    if (outcome.kind === "session-expired") onSessionEnd?.();
    closeOpen(slot.id, { busy: false, error: closeFailure(outcome) });
    if (outcome.kind === "promijenjeno") void read();
  };

  // Each composition has a generation; a result is dropped once the box was unchecked, the form closed or another one started.
  const composing = useRef(0);
  const dropAttach = () => { composing.current += 1; setAttach(NO_ATTACH); };
  const toggleAttach = async (on: boolean) => {
    if (!on) { dropAttach(); return; }
    const mine = ++composing.current;
    setAttach({ kind: "making" });
    // The same agreed tasks as "Složi iz rada" in the Mentor card (work.consultation-tasks.get).
    const readTasks = async (id: string) => {
      if (!call) return null;
      const answer = await call("work.consultation-tasks.get", { params: { documentId: id }, query: undefined, body: undefined });
      return answer.ok ? answer.body.tasks : null;
    };
    const input = await (composePreparation ?? (() => prepPort(documentId, readTasks).compose(null)))().catch(() => null);
    if (!alive.current || composing.current !== mine) return;
    setAttach(attachFrom(input));
  };

  const sendRequest = async () => {
    const iso = localToIso(request.draft);
    if (iso === null) { setRequest((f) => ({ ...f, error: t.needTime })); return; }
    const topic = optionalText(request.topic ?? "", TOPIC_MAX);
    if (topic === null) { setRequest((f) => ({ ...f, error: max(t.topicTooLong, TOPIC_MAX) })); return; }
    const prep = attachment(attach);
    if (attach.kind === "making") return;
    if (prep === null && attach.kind === "ready") {
      setRequest((f) => ({ ...f, error: attach.text.trim() === "" ? t.attachBlank : max(t.attachTooLong, PREPARATION_MAX) }));
      return;
    }
    if (!call || role !== "student" || inFlight.current.has("new")) return;
    inFlight.current.add("new");
    setNotice(null);
    setRequest((f) => ({ ...f, busy: true, error: null }));
    // An unavailable preparation is not sent: the request goes without it, as the checkbox says.
    const outcome = prep ? await requestConsultationSlotWithPreparation(call, documentId, iso, topic, prep) : await requestConsultationSlot(call, documentId, iso, topic);
    inFlight.current.delete("new");
    if (!alive.current) return;
    settle(outcome);
    if (outcome.kind === "saved") dropAttach();
    setRequest((f) => afterSlotWrite(f, outcome));
  };

  if (load.kind === "loading") return <p role="status" className={styles.muted}>{t.loading}</p>;
  if (load.kind !== "ready") {
    const text = load.kind === "signedOut" ? t.errors.signedOut : load.kind === "notFound" ? t.notFound : t.unavailable;
    return (
      <div className={styles.card}>
        <p role="alert" className={styles.error}>{text}</p>
        {load.kind === "unavailable" ? <Button size="dense" tone="secondary" onClick={() => void read()}>{t.retry}</Button> : null}
      </div>
    );
  }
  return (
    <section className={styles.card} aria-labelledby="konzultacije-termini">
      <Heading id="konzultacije-termini">{slotsHeading(load.slots)}</Heading>
      {load.slots.length === 0 ? <p className={styles.muted}>{role === "teacher" ? t.emptyTeacher : t.empty}</p> : null}
      <p role="status" className={styles.muted}>{notice ?? ""}</p>
      <ul className={styles.list}>
        {load.slots.map((slot) => {
          const form = forms[slot.id] ?? IDLE_FORM;
          const actions = actionsFor(role, slot);
          const closeActions = closeActionsFor(role, slot, now());
          const closing = closings[slot.id];
          const closedText = closingText(role, slot);
          return (
            <li key={slot.id} className={styles.item}>
              <b>{statusText(role, slot)}</b>
              <p className={styles.muted}>{lineText(slot)}</p>
              <p className={styles.noteText}>{topicText(slot)}</p>
              {slot.preparation ? <Details summary={t.preparationLine}><p className={styles.noteText}>{slot.preparation.text}</p></Details> : null}
              {closedText ? <p className={styles.muted}>{closedText}</p> : null}
              {actions.includes("confirm") ? <Button size="dense" disabled={form.busy} onClick={() => void act(slot, "confirm")}>{t.confirm}</Button> : null}
              {actions.includes("accept") ? <Button size="dense" disabled={form.busy} onClick={() => void act(slot, "accept")}>{t.accept.replace("{time}", timeText(slot.startsAt))}</Button> : null}
              {actions.includes("counter") && !form.open ? <Button size="dense" tone="secondary" disabled={form.busy} onClick={() => patch(slot.id, { open: true, error: null })}>{t.propose}</Button> : null}
              {form.open ? (
                <div className={styles.card}>
                  <label>{t.proposeLabel}
                    <input className={styles.field} type="datetime-local" value={form.draft} disabled={form.busy} onChange={(e) => patch(slot.id, { draft: e.target.value })} />
                  </label>
                  <div className={styles.row}>
                    <Button size="dense" disabled={form.busy} onClick={() => {
                      const iso = localToIso(form.draft);
                      if (iso === null) patch(slot.id, { error: t.needTime }); else void act(slot, "counter", iso);
                    }}>{form.busy ? t.sending : t.proposeSend}</Button>
                    <Button size="dense" tone="secondary" disabled={form.busy} onClick={() => patch(slot.id, { open: false, error: null })}>{t.cancel}</Button>
                  </div>
                </div>
              ) : null}
              {closeActions.length > 0 && !closing ? (
                <div className={styles.row}>
                  {closeActions.map((action) => (
                    <Button key={action} size="dense" tone="secondary" disabled={form.busy}
                      onClick={() => { setNotice(null); setClosings((all) => ({ ...all, [slot.id]: { action, reason: "", busy: false, error: null } })); }}>
                      {CLOSE_LABEL[action]}
                    </Button>
                  ))}
                </div>
              ) : null}
              {closing ? (
                <div className={styles.card} role="group" aria-label={t.closeTitle[closing.action]}>
                  <h4>{t.closeTitle[closing.action]}</h4>
                  <TextArea label={t.reasonLabel} hint={max(t.reasonHint, REASON_MAX)} rows={2} value={closing.reason} busy={closing.busy}
                    onChange={(e) => closeOpen(slot.id, { reason: e.target.value })} />
                  <div className={styles.row}>
                    <Button size="dense" disabled={closing.busy} onClick={() => void close(slot)}>{closing.busy ? t.sending : t.closeSend}</Button>
                    <Button size="dense" tone="secondary" disabled={closing.busy} onClick={() => closeShut(slot.id)}>{t.cancel}</Button>
                  </div>
                  {closing.error ? <p role="alert" className={styles.error}>{closing.error}</p> : null}
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
            <TextField label={t.topicLabel} hint={max(t.topicHint, TOPIC_MAX)} value={request.topic ?? ""} busy={request.busy}
              onChange={(e) => setRequest((f) => ({ ...f, topic: e.target.value }))} />
            <Checkbox label={t.attach} hint={t.attachHint} checked={attach.kind !== "off"} disabled={request.busy}
              onChange={(e) => void toggleAttach(e.currentTarget.checked)} />
            {attach.kind === "making" ? <p role="status" className={styles.muted}>{t.attachMaking}</p> : null}
            {attach.kind === "unavailable" ? <p role="alert" className={styles.error}>{t.attachUnavailable}</p> : null}
            {attach.kind === "ready" ? (
              <>
                <TextArea label={t.attachLabel} hint={t.attachCounts.replace("{changed}", String(attach.changed)).replace("{resolved}", String(attach.resolved))}
                  rows={8} value={attach.text} busy={request.busy} onChange={(e) => { const text = e.currentTarget.value; setAttach((a) => (a.kind === "ready" ? { ...a, text } : a)); }} />
              </>
            ) : null}
            <div className={styles.row}>
              <Button size="dense" disabled={request.busy || attach.kind === "making"} onClick={() => void sendRequest()}>{request.busy ? t.sending : t.requestSend}</Button>
              <Button size="dense" tone="secondary" disabled={request.busy} onClick={() => { setRequest(IDLE_FORM); dropAttach(); }}>{t.cancel}</Button>
            </div>
            {request.error ? <p role="alert" className={styles.error}>{request.error}</p> : null}
          </div>
        ) : <Button size="dense" tone="secondary" onClick={() => setRequest({ ...IDLE_FORM, open: true })}>{t.requestTitle}</Button>
      ) : null}
    </section>
  );
}
