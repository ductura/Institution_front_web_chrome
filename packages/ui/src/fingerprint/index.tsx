"use client";

import { useState } from "react";

import { Button } from "../components/Button";
import { ToastRegion, useToasts } from "../components/Toast";
import styles from "./fingerprint.module.css";
import { fingerprintMessages as t } from "./messages.hr";

export type FingerprintProps = { value: string };

export function Fingerprint({ value }: FingerprintProps) {
  const [copying, setCopying] = useState(false);
  const { toasts, show, dismiss } = useToasts();

  if (value.length !== 64 || /[^0-9a-f]/i.test(value)) return null;

  async function copy() {
    setCopying(true);
    try {
      await navigator.clipboard.writeText(value);
      show(t.copied);
    } catch {
      show(t.copyFailed, "error");
    } finally {
      setCopying(false);
    }
  }

  return (
    <div className={styles.fingerprint}>
      <code className={styles.digest}>
        {value.match(/.{4}/g)?.map((group, index) => <span key={index}>{group}</span>)}
      </code>
      <Button tone="quiet" busy={copying} onClick={copy}>{t.copy}</Button>
      <ToastRegion toasts={toasts} onDismiss={dismiss} label={t.notifications} closeLabel={t.close} />
    </div>
  );
}
