"use client";

import { Button, TextField } from "@ductura/ui";
import { useCallback, useEffect, useId, useRef, useState } from "react";

import { zagrebParts } from "../summary/zagreb-time";

import { parseVerificationCode, readVerificationFields, type VerificationCode } from "./code";
import { publicVerificationHr as t } from "./messages.hr";
import { verifyReceipt, type VerificationResult } from "./verify-receipt";
import styles from "./verification.module.css";

export type VerificationState = VerificationResult | { kind: "idle" | "invalid" | "pending" };
const emptyCode: VerificationCode = { receiptId: "", fingerprint: "" };

function ReceiptTime({ iso }: { iso: string }) {
  const local = zagrebParts(iso);
  return <time dateTime={iso}>{local ? `${local.date} ${local.time}` : iso}</time>;
}

export function VerificationFeedback({ state }: { state: VerificationState }) {
  return (
    <div role="status">
      {state.kind !== "idle" && (
        <div className={styles.feedback}>
          <p>{t[state.kind]}</p>
          {state.kind === "matched" && (
            <dl>
              <dt>{t.submittedAt}</dt>
              <dd><ReceiptTime iso={state.submittedAt} /></dd>
              <dt>{t.signedAt}</dt>
              <dd><ReceiptTime iso={state.signedAt} /></dd>
              <dt>{t.keyId}</dt>
              <dd>{state.keyId}</dd>
            </dl>
          )}
        </div>
      )}
    </div>
  );
}

export function PublicVerification() {
  const [code, setCode] = useState(emptyCode);
  const [state, setState] = useState<VerificationState>({ kind: "idle" });
  const request = useRef(0);
  const lastFragment = useRef("");

  const check = useCallback(async (parsed: VerificationCode | null) => {
    const current = ++request.current;
    if (parsed === null) {
      setState({ kind: "invalid" });
      return;
    }
    setState({ kind: "pending" });
    const result = await verifyReceipt(parsed).catch(() => ({ kind: "unavailable" } as const));
    if (current === request.current) setState(result);
  }, []);

  useEffect(() => {
    function readQr() {
      const fragment = globalThis.location.hash;
      if (fragment === lastFragment.current) return;
      lastFragment.current = fragment;
      if (!fragment) return;
      const parsed = parseVerificationCode(fragment);
      setCode(parsed ?? emptyCode);
      void check(parsed);
    }
    readQr();
    globalThis.addEventListener("hashchange", readQr);
    return () => globalThis.removeEventListener("hashchange", readQr);
  }, [check]);

  return (
    <main id="sadrzaj" tabIndex={-1} className={styles.page}>
      <VerificationForm
        code={code}
        state={state}
        onChange={(nextCode) => {
          setCode(nextCode);
          setState({ kind: "idle" });
        }}
        onVerify={() => {
          void check(code.fingerprint.trim() === ""
            ? parseVerificationCode(code.receiptId)
            : readVerificationFields(code));
        }}
      />
    </main>
  );
}

type VerificationFormProps = {
  code?: VerificationCode;
  state: VerificationState;
  onChange?: (code: VerificationCode) => void;
  onVerify?: () => void;
};

export function VerificationForm({ code = emptyCode, state, onChange, onVerify }: VerificationFormProps) {
  const title = useId();
  const pending = state.kind === "pending";
  return (
    <section className={styles.panel} aria-labelledby={title}>
      <h1 id={title}>{t.title}</h1>
      <p className={styles.intro}>{t.intro}</p>
      <form className={styles.form} onSubmit={(event) => {
        event.preventDefault();
        if (!pending) onVerify?.();
      }}>
        {(["receiptId", "fingerprint"] as const).map((field) => (
          <TextField
            key={field}
            label={t[field]}
            value={code[field]}
            onChange={(event) => onChange?.({ ...code, [field]: event.target.value })}
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            busy={pending}
            readOnly={onChange === undefined}
          />
        ))}
        <Button type="submit" busy={pending} disabled={onVerify === undefined}>{t.submit}</Button>
      </form>
      <VerificationFeedback state={state} />
    </section>
  );
}
