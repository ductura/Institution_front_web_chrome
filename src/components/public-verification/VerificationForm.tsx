"use client";

import { Button, TextField } from "@ductura/ui";
import { useCallback, useEffect, useRef, useState } from "react";

import { zagrebParts } from "@/components/summary/zagreb-time";

import { parseVerificationCode } from "./code";
import { publicVerificationHr as t } from "./messages.hr";
import { verifyReceipt, type VerificationResult } from "./verify-receipt";
import styles from "./verification.module.css";

type State = VerificationResult | { kind: "idle" | "invalid" | "pending" };

function ReceiptTime({ iso }: { iso: string }) {
  const local = zagrebParts(iso);
  return <time dateTime={iso}>{local ? `${local.date} ${local.time}` : iso}</time>;
}

export function VerificationFeedback({ state }: { state: State }) {
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

export function VerificationForm() {
  const [code, setCode] = useState("");
  const [state, setState] = useState<State>({ kind: "idle" });
  const request = useRef(0);
  const lastFragment = useRef("");
  const pending = state.kind === "pending";
  const invalid = state.kind === "invalid";

  const check = useCallback(async (value: string) => {
    const current = ++request.current;
    const parsed = parseVerificationCode(value);
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
      setCode(fragment);
      void check(fragment);
    }
    readQr();
    globalThis.addEventListener("hashchange", readQr);
    return () => globalThis.removeEventListener("hashchange", readQr);
  }, [check]);

  return (
    <main id="sadrzaj" tabIndex={-1} className={styles.page}>
      <section className={styles.panel} aria-labelledby="provjera-naslov">
        <h1 id="provjera-naslov">{t.title}</h1>
        <p className={styles.intro}>{t.intro}</p>
        <form className={styles.form} onSubmit={(event) => {
          event.preventDefault();
          if (!pending) void check(code);
        }}>
          <TextField
            label={t.code}
            value={code}
            onChange={(event) => {
              setCode(event.target.value);
              setState({ kind: "idle" });
            }}
            error={invalid ? t.invalid : undefined}
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            busy={pending}
          />
          <Button type="submit" busy={pending}>{t.submit}</Button>
        </form>
        <VerificationFeedback state={state} />
      </section>
    </main>
  );
}
