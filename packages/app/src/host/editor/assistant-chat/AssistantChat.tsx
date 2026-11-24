"use client";

// ED-10 (NF2-P10, ASIST-1..9): the Asistent card, as in the prototype's nf2.js aiCard. The notice of
// the assignment decides whether and for what the Asistent may be asked; every question and answer
// is recorded by the server and read back from it (student.assistant-conversation.get).
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";

import { useAssignmentNotice } from "../assistant-rules/assistant-rules";
import { assistantRulesHr } from "../assistant-rules/messages.hr";
import {
  askablePurposes, clockOf, createAssistantPort, exchangesOf, keepConversation, keptConversations, newKey, titleOf,
  type AssistantPort, type ConversationRead, type Kept,
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

export function AssistantChatView({ assignmentId, readOnly, port }: { assignmentId: string; readOnly: boolean; port: AssistantPort }) {
  const notice = useAssignmentNotice(assignmentId);
  const online = useOnline();
  const ids = useId();
  const field = useRef<HTMLTextAreaElement>(null);

  const [kept, setKept] = useState<Kept[]>([]);
  const [reads, setReads] = useState<Readonly<Record<string, ConversationRead>>>({});
  const [current, setCurrent] = useState<string | null>(null);
  const [purpose, setPurpose] = useState<string>("");
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<Banner | null>(null);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [say, setSay] = useState("");
  const [fieldError, setFieldError] = useState(false);

  const load = useCallback(async (id: string) => {
    const read = await port.read(id);
    setReads((prev) => ({ ...prev, [id]: read }));
  }, [port]);

  useEffect(() => {
    const list = keptConversations(assignmentId);
    setKept(list);
    for (const k of list.slice(-10)) void load(k.id);
  }, [assignmentId, load]);

  const available = notice?.kind === "available" ? notice.view : null;
  const prohibited = available?.aiPolicy === "prohibited";
  const purposes = useMemo(() => askablePurposes(available?.aiPurposes ?? []), [available]);
  useEffect(() => {
    if (purposes.length > 0 && !purposes.includes(purpose as (typeof purposes)[number])) setPurpose(purposes[0]!);
  }, [purposes, purpose]);

  const blocked = banner === "disabled" || banner === "limit" || banner === "forbidden";
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
    setFieldError(false);
    setBusy(true);
    setBanner(null);
    setSay(t.say.asking);
    const outcome = await port.ask({ assignmentId, conversationId: current, purposeKey: chosen, paragraph: draft }, key);
    setBusy(false);
    if (outcome.kind === "unavailable" || outcome.kind === "signedOut") {
      setPendingKey(key);
      setBanner(outcome.kind === "signedOut" ? "signedOut" : "failed");
      setSay(t.say.failed);
      return;
    }
    setPendingKey(null);
    if (outcome.conversationId !== null) {
      const id = outcome.conversationId;
      setKept(keepConversation(assignmentId, { id, purposeKey: chosen }));
      setCurrent(id);
      await load(id);
    }
    if (outcome.kind === "answered") {
      setDraft("");
      setSay(t.say.answered);
    } else {
      setBanner(outcome.kind);
      setSay(t.say.failed);
    }
    field.current?.focus();
  }

  function fresh() {
    setCurrent(null);
    setPendingKey(null);
    setSay(t.say.fresh);
    field.current?.focus();
  }

  const tag = prohibited ? t.tag.prohibited : banner === "disabled" ? t.tag.disabled : banner === "limit" ? t.tag.limit : t.tag.on;
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
            <select id={purposeId} className={styles.in} value={purpose} onChange={(e) => setPurpose(e.target.value)}>
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

      {kept.length === 0 ? <p className={styles.muted}>{t.none}</p> : <>
        <h4 className={styles.sub}>{t.conversations(kept.length)}</h4>
        {newestFirst.map((k, i) => <Conversation key={k.id} kept={k} read={reads[k.id]} open={i === 0} />)}
        <p className={styles.muted}>{t.thisDevice}</p>
      </>}
    </section>
  );
}

export function AssistantChat({ assignmentId, readOnly }: { assignmentId: string; readOnly: boolean }) {
  const port = useMemo(() => createAssistantPort(), []);
  return <AssistantChatView assignmentId={assignmentId} readOnly={readOnly} port={port} />;
}
