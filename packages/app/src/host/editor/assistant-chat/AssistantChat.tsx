"use client";

// ED-10 (NF2-P10, ASIST-1..9): the Asistent card, as in the prototype's nf2.js aiCard. The notice of
// the assignment decides whether and for what the Asistent may be asked; every question and answer
// is recorded by the server and read back from it (student.assistant-conversation.get).
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";

import { useAssignmentNotice } from "../assistant-rules/assistant-rules";
import { assistantRulesHr } from "../assistant-rules/messages.hr";
import {
  SHOWN, askablePurposes, clockOf, createAssistantPort, exchangesOf, heldChat, keepConversation, keptConversations, mergeConversations, newKey, requestsLeft, titleOf,
  type AssistantPort, type AvailabilityRead, type ConversationRead, type ConversationsRead, type RemainingRead, type HeldChat, type Kept,
} from "./assistant-chat";
import { assistantChatHr as t } from "./messages.hr";
import styles from "./AssistantChat.module.css";

type Banner = "failed" | "busy" | "purpose" | "forbidden" | "disabled" | "limit" | "signedOut";

function useOnline(): boolean {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const update = () => setOnline(globalThis.navigator?.onLine !== false);
    update();
    globalThis.addEventListener("online", update);
    globalThis.addEventListener("offline", update);
    return () => {
      globalThis.removeEventListener("online", update);
      globalThis.removeEventListener("offline", update);
    };
  }, []);
  return online;
}

/** State that outlives the card: read from and written through to the held slot (see heldChat). */
function useHeld<K extends keyof HeldChat>(slot: HeldChat, field: K): [HeldChat[K], (value: HeldChat[K]) => void] {
  const [value, setValue] = useState<HeldChat[K]>(slot[field]);
  const set = useCallback((next: HeldChat[K]) => {
    slot[field] = next;
    setValue(next);
  }, [slot, field]);
  return [value, set];
}

const purposeLabel = (key: string) =>
  (assistantRulesHr.purposes as Readonly<Record<string, string>>)[key] ?? key;

function BannerView({ kind, onRetry }: { kind: Banner; onRetry: () => void }) {
  if (kind === "failed") {
    return (
      <div className={`${styles.banner} ${styles.asb}`} role="alert">
        <span><b>{t.errorLead}</b>{t.error}</span>
        <button type="button" className={styles.btn} onClick={onRetry}>{t.retry}</button>
      </div>
    );
  }
  const text: Record<Exclude<Banner, "failed">, [string, string]> = {
    busy: ["", t.busyBanner],
    purpose: ["", t.purposeRefused],
    forbidden: ["", t.forbidden],
    disabled: [t.disabledLead, t.disabled],
    limit: [t.limitLead, t.limit],
    signedOut: ["", t.signedOut],
  };
  const [lead, rest] = text[kind];
  return <div className={`${styles.banner} ${styles.asb}`} role="status">{lead ? <b>{lead}</b> : null}{rest}</div>;
}

function Conversation({ kept, read, open }: { kept: Kept; read: ConversationRead | undefined; open: boolean }) {
  const messages = read?.kind === "ok" ? read.messages : [];
  const exchanges = exchangesOf(messages);
  return (
    <details className={styles.cv} open={open} data-conversation={kept.id}>
      <summary>
        <b>{read === undefined ? t.loadingConversation : read.kind === "ok" ? titleOf(messages) : t.unreadable}</b>{" "}
        <span className={styles.muted}>· {purposeLabel(kept.purposeKey)}{read?.kind === "ok" ? ` · ${t.questions(exchanges.length)}` : ""}</span>
      </summary>
      {read?.kind === "ok" ? exchanges.map((e) => (
        <div key={e.question.seq}>
          <div className={styles.m}><b>{t.you} · {clockOf(e.question.at)}</b>{e.question.text}</div>
          {e.answer === null
            ? <div className={`${styles.m} ${styles.a}`}><b>{t.assistant}</b>{t.noAnswer}</div>
            : <div className={`${styles.m} ${styles.a}`}><b>{t.assistant} · {clockOf(e.answer.at)}</b>{e.answer.text}</div>}
        </div>
      )) : null}
    </details>
  );
}

export function AssistantChatView({ assignmentId, scope, readOnly, port }: { assignmentId: string; scope: string; readOnly: boolean; port: AssistantPort }) {
  const notice = useAssignmentNotice(assignmentId);
  const online = useOnline();
  const ids = useId();
  const field = useRef<HTMLTextAreaElement>(null);
  const refocus = useRef(false);

  // Held above the drawer's mount boundary: closing the panel on a narrow screen keeps all of this.
  const slot = useMemo(() => heldChat(scope, assignmentId), [scope, assignmentId]);
  const [keptHeld, setKeptHeld] = useHeld(slot, "kept");
  const kept: readonly Kept[] = keptHeld ?? [];
  const [reads, setReads] = useState<Readonly<Record<string, ConversationRead>>>({});
  const [current, setCurrent] = useHeld(slot, "current");
  const [purpose, setPurpose] = useHeld(slot, "purpose");
  const [draft, setDraft] = useHeld(slot, "draft");
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<Banner | null>(null);
  const [pendingKey, setPendingKey] = useHeld(slot, "pendingKey");
  const [say, setSay] = useState("");
  const [fieldError, setFieldError] = useState(false);

  const [availability, setAvailability] = useState<AvailabilityRead | null>(null);
  const [remaining, setRemaining] = useState<RemainingRead | null>(null);
  const [listRead, setListRead] = useState<ConversationsRead | null>(null);

  // Ids this instance has asked to read: the held list is shared with closed cards, so it cannot say that.
  const requested = useRef(new Set<string>());
  const load = useCallback(async (id: string) => {
    requested.current.add(id);
    const read = await port.read(id);
    setReads((prev) => ({ ...prev, [id]: read }));
  }, [port]);

  useEffect(() => {
    // Only the last SHOWN are kept and shown, and every one shown is read: none stays on "Učitavam razgovor…".
    const list = (slot.kept ?? keptConversations(scope, assignmentId)).slice(-SHOWN);
    setKeptHeld(list);
    for (const k of list) void load(k.id);
  }, [slot, scope, assignmentId, load, setKeptHeld]);

  // Read from the server: whether the Asistent is on for the course, today's count and the conversation list.
  const refreshRemaining = useCallback(async () => setRemaining(await port.remaining(assignmentId)), [port, assignmentId]);
  const refreshList = useCallback(async (live: () => boolean = () => true) => {
    const list = await port.conversations(assignmentId);
    // A card closed meanwhile (drawer) must not change the held list or the state of a newer card.
    if (!live()) return;
    setListRead(list);
    if (list.kind !== "ok") return;
    const merged = mergeConversations(list.conversations, slot.kept ?? keptConversations(scope, assignmentId));
    setKeptHeld(merged);
    for (const k of merged) if (!requested.current.has(k.id)) void load(k.id);
  }, [port, assignmentId, slot, scope, load, setKeptHeld]);
  useEffect(() => {
    let live = true;
    void port.availability(assignmentId).then((a) => { if (live) setAvailability(a); });
    void refreshRemaining();
    void refreshList(() => live);
    return () => { live = false; };
  }, [port, assignmentId, refreshRemaining, refreshList]);

  const available = notice?.kind === "available" ? notice.view : null;
  const prohibited = available?.aiPolicy === "prohibited";
  const purposes = useMemo(() => askablePurposes(available?.aiPurposes ?? []), [available]);
  useEffect(() => {
    if (purposes.length > 0 && !purposes.includes(purpose as (typeof purposes)[number])) setPurpose(purposes[0]!);
  }, [purposes, purpose, setPurpose]);

  const serverOff = availability?.kind === "ok" && !availability.enabled;
  const serverLimit = remaining?.kind === "ok" && requestsLeft(remaining) === 0;
  const left = remaining?.kind === "ok" ? requestsLeft(remaining) : null;
  // A request sent but not settled (pendingKey) can still be recovered with its key at the limit; new ones cannot.
  const blocked = banner === "disabled" || banner === "limit" || banner === "forbidden" || serverOff || (serverLimit && pendingKey === null);
  const canAsk = !readOnly && available !== null && !prohibited && purposes.length > 0 && !blocked;

  async function send() {
    if (busy || !online) return;
    if (draft.trim() === "") {
      setFieldError(true);
      field.current?.focus();
      return;
    }
    const chosen = purposes.find((p) => p === purpose);
    if (chosen === undefined) return;
    const key = pendingKey ?? newKey();
    const sent = draft;
    // Held before asking: if the drawer closes mid-request, reopening retries this request, not a new one.
    setPendingKey(key);
    setFieldError(false);
    setBusy(true);
    setBanner(null);
    setSay(t.say.asking);
    try {
      const outcome = await port.ask({ assignmentId, conversationId: current, purposeKey: chosen, paragraph: sent }, key);
      if (outcome.kind === "unavailable" || outcome.kind === "signedOut") {
        setBanner(outcome.kind === "signedOut" ? "signedOut" : "failed");
        setSay(t.say.failed);
        return;
      }
      // in_progress (busy): the original request still runs, so its outcome is unknown. Keep its key, so
      // asking again recovers that request instead of recording and charging a duplicate.
      if (outcome.kind !== "busy") setPendingKey(null);
      if (outcome.conversationId !== null) {
        const id = outcome.conversationId;
        setKeptHeld(keepConversation(scope, assignmentId, { id, purposeKey: chosen }, undefined, slot.kept ?? []));
        setCurrent(id);
        await load(id);
      }
      void refreshRemaining();
      if (outcome.kind === "answered") {
        // Only the question that was sent is cleared: never a newer draft.
        if (slot.draft === sent) setDraft("");
        setSay(t.say.answered);
      } else {
        setBanner(outcome.kind);
        setSay(t.say.failed);
      }
    } finally {
      // The form stays busy until the conversation is read and the draft is settled. Focus returns once
      // the fieldset is enabled again (the effect below), since a disabled field cannot take it.
      refocus.current = true;
      setBusy(false);
    }
  }

  useEffect(() => {
    if (busy || !refocus.current) return;
    refocus.current = false;
    field.current?.focus();
  }, [busy]);

  function fresh() {
    setCurrent(null);
    setPendingKey(null);
    setSay(t.say.fresh);
    field.current?.focus();
  }

  const tag = prohibited ? t.tag.prohibited : banner === "disabled" || serverOff ? t.tag.disabled : banner === "limit" || serverLimit ? t.tag.limit : t.tag.on;
  const newestFirst = [...kept].reverse();
  const purposeId = `${ids}-purpose`;
  const promptId = `${ids}-prompt`;
  const errorId = `${ids}-error`;

  return (
    <section className={styles.chat} aria-labelledby={`${ids}-title`} data-assistant-chat>
      <h3 id={`${ids}-title`} className={styles.title}>
        {t.title} <span className={`${styles.tag} ${prohibited || blocked ? styles.warn : styles.ok}`}>{tag}</span>
      </h3>
      <p className={styles.asn}><b>{t.noticeLead}</b>{t.notice}</p>
      <p className={styles.sr} aria-live="polite" role="status">{say}</p>

      {!online ? <div className={`${styles.banner} ${styles.asb}`} role="status"><b>{t.offlineLead}</b>{t.offline}</div> : null}
      {prohibited ? <div className={`${styles.banner} ${styles.asb}`} role="status"><b>{t.prohibitedLead}</b>{t.prohibited}</div> : null}
      {serverOff && banner === null ? <BannerView kind="disabled" onRetry={() => undefined} /> : null}
      {serverLimit && !serverOff && banner === null ? <BannerView kind="limit" onRetry={() => undefined} /> : null}
      {remaining?.kind === "ok" && remaining.limit !== null && !serverLimit
        ? <p className={styles.muted} data-requests-left>{t.remaining(left ?? 0, remaining.limit)}</p> : null}
      {remaining?.kind === "unavailable" ? <p className={styles.muted} role="status">{t.remainingUnavailable}</p> : null}
      {banner !== null ? <BannerView kind={banner} onRetry={() => void send()} /> : null}

      {readOnly ? <p className={styles.muted}>{t.readOnly}</p>
        : notice === null ? <p className={styles.muted} role="status">{t.rulesLoading}</p>
        : available === null ? <p className={styles.muted}>{t.rulesUnknown}</p>
        : !prohibited && purposes.length === 0 ? <p className={styles.muted}>{t.noPurpose}</p>
        : null}

      {canAsk ? (
        <form className={styles.form} onSubmit={(e) => { e.preventDefault(); void send(); }} aria-busy={busy || undefined}>
          <fieldset className={styles.fieldset} disabled={!online || busy}>
            <label className={styles.f} htmlFor={purposeId}>{t.purpose}</label>
            <select id={purposeId} className={styles.in} value={purpose} onChange={(e) => { setPurpose(e.target.value); setPendingKey(null); }}>
              {purposes.map((p) => <option key={p} value={p}>{purposeLabel(p)}</option>)}
            </select>
            <label className={styles.f} htmlFor={promptId}>{t.prompt}</label>
            <textarea id={promptId} ref={field} className={styles.ta} rows={4} maxLength={2000} value={draft}
              aria-invalid={fieldError || undefined} aria-describedby={fieldError ? errorId : undefined}
              onChange={(e) => { setDraft(e.target.value); setFieldError(false); setPendingKey(null); }} />
            {fieldError ? <p id={errorId} className={styles.error}>{t.empty}</p> : null}
            <div className={`${styles.row} ${styles.asl}`}>
              <button type="submit" className={`${styles.btn} ${styles.pri}`}>{t.send}</button>
              <button type="button" className={styles.btn} disabled={current === null} onClick={fresh}>{t.newConversation}</button>
            </div>
          </fieldset>
          {busy ? <p className={`${styles.muted} ${styles.asl}`}><span className={styles.dot} aria-hidden="true" /> {t.answering}</p> : null}
        </form>
      ) : null}

      {listRead !== null && listRead.kind !== "ok" && listRead.kind !== "signedOut" ? <p className={styles.muted} role="status">{t.listUnavailable}</p> : null}
      {kept.length === 0 ? <p className={styles.muted}>{t.none}</p> : <>
        <h4 className={styles.sub}>{t.conversations(kept.length)}</h4>
        {newestFirst.map((k, i) => <Conversation key={k.id} kept={k} read={reads[k.id]} open={i === 0} />)}
        <p className={styles.muted}>{listRead?.kind === "ok" ? "" : t.thisDevice}</p>
      </>}
    </section>
  );
}

export function AssistantChat({ assignmentId, scope, readOnly }: { assignmentId: string; scope: string; readOnly: boolean }) {
  const port = useMemo(() => createAssistantPort(), []);
  return <AssistantChatView assignmentId={assignmentId} scope={scope} readOnly={readOnly} port={port} />;
}
