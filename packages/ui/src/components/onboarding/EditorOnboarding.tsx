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
  onClose: () => void;
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

  useEffect(() => {
    if (mode === "help") heading.current?.focus();
  }, [mode]);

  function close() {
    setStep(0);
    onClose();
  }

  return <>
    <div aria-live="polite" aria-atomic="true" className={styles.announcement} lang={locale}>
      {mode && `${step === 0 ? `${t.title}. ${t.duration}. ` : ""}${progress}. ${title}. ${description}`}
    </div>
    {mode && <section className={styles.guide} lang={locale} aria-labelledby={id} onKeyDown={(event) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        close();
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
        <Button ref={next} onClick={last ? close : () => setStep(step + 1)}>{last ? t.finish : t.next}</Button>
        <Button tone="quiet" onClick={close}>{t.skip}</Button>
      </div>
    </section>}
  </>;
}
