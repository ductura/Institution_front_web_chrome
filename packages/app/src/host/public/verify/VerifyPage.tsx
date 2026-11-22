"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { appHref } from "@/components/shell/nav";
import { VerificationForm, type VerificationState } from "@/components/public-verification/VerificationForm";
import { verifyReceipt } from "@/components/public-verification/verify-receipt";
import type { VerificationCode } from "@/components/public-verification/code";
import { messagesHr as app } from "../../../../../../locales/hr.ts";

import { useHost } from "../../context";
import { EMPTY_CODE, formCode, fragmentCode, runCheck, type Verify } from "./model";

/**
 * /provjera (WEB-2111; R-41, V-5, C-6): anyone checks a receipt without signing in.
 * The number and the fingerprint go to public.verification.post with no cookie
 * (verifyReceipt); the QR code of the record opens the page with them in the
 * fragment, which fills the form and checks at once. States: idle, invalid,
 * pending, matched (times and key), notMatched, rateLimited, unavailable.
 */
export default function VerifyPage({ verify = verifyReceipt }: { verify?: Verify }) {
  const { base } = useHost();
  const [code, setCode] = useState<VerificationCode>(EMPTY_CODE);
  const [state, setState] = useState<VerificationState>({ kind: "idle" });
  const request = useRef(0);
  const lastFragment = useRef("");

  const check = useCallback(async (parsed: VerificationCode | null) => {
    const current = ++request.current;
    if (parsed !== null) setState({ kind: "pending" });
    const next = await runCheck(parsed, verify);
    // Only the last check speaks: an earlier answer arriving late is dropped.
    if (current === request.current) setState(next);
  }, [verify]);

  useEffect(() => {
    const readFragment = () => {
      const hash = window.location.hash;
      if (hash === lastFragment.current) return;
      lastFragment.current = hash;
      const asked = fragmentCode(hash);
      if (asked === null) return;
      setCode(asked.code ?? EMPTY_CODE);
      void check(asked.code);
    };
    readFragment();
    window.addEventListener("hashchange", readFragment);
    return () => window.removeEventListener("hashchange", readFragment);
  }, [check]);

  return (
    <main id="sadrzaj" tabIndex={-1} className="page">
      <header>
        <a href={appHref(base, "/")}>{app.app.name}</a>
      </header>
      <VerificationForm
        code={code}
        state={state}
        onChange={(next) => {
          request.current += 1;
          setCode(next);
          setState({ kind: "idle" });
        }}
        onVerify={() => { void check(formCode(code)); }}
      />
    </main>
  );
}
