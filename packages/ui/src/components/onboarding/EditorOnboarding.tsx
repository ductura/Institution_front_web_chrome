"use client";

import { useEffect, useId, useRef, useState } from "react";

import { Button } from "../Button";
import { onboardingEn } from "./messages.en";
import { onboardingHr } from "./messages.hr";
import styles from "./EditorOnboarding.module.css";

export const editorOnboardingMessages = { hr: onboardingHr, en: onboardingEn };

type Props = {
  locale: keyof typeof editorOnboardingMessages;
  mode: "automatic" | "help" | null;
  /** How it was closed: "finish" and "skip" mark the guide seen for the host, "dismiss" (Esc) does not. */
  onClose: (how: "finish" | "skip" | "dismiss") => void;
};

export function EditorOnboarding({ locale, mode, onClose }: Props) {
  const id = useId();
  const heading = useRef<HTMLHeadingElement>(null);
  const next = useRef<HTMLButtonElement>(null);
  const [step, setStep] = useState(0);
  const t = editorOnboardingMessages[locale];
  const [title, description] = t.steps[step] ?? t.steps[0];
  const last = step === t.steps.length - 1;
  const progress = t.progress.replace("{step}", String(step + 1)).replace("{total}", String(t.steps.length));

  // NF2-P20: focus goes to the heading when the guide opens; one opening by itself never takes it from
  // a student who is already writing or working in a field.
  useEffect(() => {
    if (mode === null) return;
    const active = document.activeElement;
    if (mode === "help" || active === null || active === document.body) heading.current?.focus();
  }, [mode]);

  function close(how: "finish" | "skip" | "dismiss") {
    setStep(0);
    onClose(how);
  }

  return <>
    <div aria-live="polite" aria-atomic="true" className={styles.announcement} lang={locale}>
      {mode && `${step === 0 ? `${t.title}. ${t.duration}. ` : ""}${progress}. ${title}. ${description}`}
    </div>
    {mode && <section className={styles.guide} lang={locale} aria-labelledby={id} onKeyDown={(event) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        close("dismiss");
      }
    }}>
      <h2 id={id} ref={heading} tabIndex={-1}>{t.title}</h2>
      <p>{t.duration} · {progress}</p>
      <h3>{title}</h3>
      <p>{description}</p>
      <div className={styles.actions}>
        <Button tone="quiet" disabled={step === 0} onClick={() => {
          if (step === 1) next.current?.focus();
          setStep(step - 1);
        }}>
          {t.previous}
        </Button>
        <Button ref={next} onClick={last ? () => close("finish") : () => setStep(step + 1)}>{last ? t.finish : t.next}</Button>
        <Button tone="quiet" onClick={() => close("skip")}>{t.skip}</Button>
      </div>
    </section>}
  </>;
}
