"use client";

/**
 * ED-07 (NF2-P18, prototype nf2prob): "Javi problem" next to the stopped-sending notice. The dialog says what goes
 * into the report (the state marker and the page's version, never the text of the work), takes an optional note
 * and sends one support.problem-report.post. The outcome is said in a status line under the notice.
 */
import { useRef, useState } from "react";
import { createPortal } from "react-dom";

import { Button, Dialog, TextArea } from "@ductura/ui";
import { sendProblemReport, type ProblemReportCall } from "@/components/support/problem-report-send";
import { textOf } from "@/components/support/problem-report-form";
import { PROBLEM_REPORT_DESCRIPTION_MAX } from "@/components/support/problem-report";
import { messagesHr } from "@/lib/i18n/messages.hr";

import { stoppedReportHr as t } from "./messages.hr";
import { stoppedReportBody, stoppedReportCall } from "./stopped-report";

type Step = { kind: "closed" } | { kind: "open"; error: string | null } | { kind: "sending" } | { kind: "sent" };

/** The failure text of a send that did not go: the support catalogue's own words. */
export function failureText(messageKey: string): string {
  return textOf(messageKey) ?? messagesHr.support.failure.unknown;
}

export function StoppedReport({ call = stoppedReportCall }: { call?: ProblemReportCall } = {}) {
  const [step, setStep] = useState<Step>({ kind: "closed" });
  const [note, setNote] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const field = useRef<HTMLTextAreaElement>(null);
  const sending = step.kind === "sending";
  const open = step.kind === "open" || sending;

  const close = () => { if (!sending) setStep({ kind: "closed" }); };
  const submit = async (event?: { preventDefault(): void }) => {
    event?.preventDefault();
    if (sending) return;
    const body = stoppedReportBody(note, window.location.pathname, navigator.userAgent);
    if (body === null) { setStep({ kind: "open", error: t.noteRefused }); return; }
    setStep({ kind: "sending" });
    let outcome;
    try {
      outcome = await sendProblemReport(call, body, Date.now());
    } catch {
      outcome = { kind: "failed" as const, messageKey: "support.failure.network", retryAt: null };
    }
    if (outcome.kind === "sent") {
      setNote("");
      setResult(t.sent);
      setStep({ kind: "sent" });
    } else {
      setStep({ kind: "open", error: failureText(outcome.messageKey) });
    }
  };

  return (
    <>
      <Button tone="secondary" className="editor-export" onClick={() => { setResult(null); setStep({ kind: "open", error: null }); }}>
        {t.open}
      </Button>
      <p className="editor-notice" role="status">{result}</p>
      {typeof document === "undefined" ? null : createPortal(<Dialog
        open={open}
        title={t.title}
        onClose={close}
        dismissible={!sending}
        initialFocus={field}
        error={step.kind === "open" && step.error !== null ? step.error : undefined}
        actions={(
          <>
            <Button tone="secondary" onClick={close} busy={sending}>{t.cancel}</Button>
            <Button tone="primary" onClick={() => void submit()} busy={sending}>{sending ? t.sending : t.send}</Button>
          </>
        )}
      >
        <p>{t.lead}</p>
        <dl className="stopped-report-facts">
          <div><dt>{t.stateLabel}</dt><dd>{t.stateValue}</dd></div>
          <div><dt>{t.kindLabel}</dt><dd>{t.kindValue}</dd></div>
        </dl>
        <form onSubmit={(event) => void submit(event)}>
          <TextArea
            ref={field}
            label={t.note}
            placeholder={t.notePlaceholder}
            maxLength={PROBLEM_REPORT_DESCRIPTION_MAX}
            rows={3}
            value={note}
            busy={sending}
            onChange={(event) => setNote(event.target.value)}
          />
        </form>
      </Dialog>, document.body)}
    </>
  );
}
