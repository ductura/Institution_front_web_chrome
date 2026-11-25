"use client";

import { useEffect, useRef, useState } from "react";

import { readJournalScope } from "../../../../../../src/components/editor/EditorPage.scope";
import { parseInterfaceLocale, type InterfaceLocale } from "../../../../../../src/lib/i18n/locale";
import { markOnboardingSeen, onboardingKey, onboardingSeen } from "./seen";

/** ED-05 (NF2-P20): the guide opens by itself this long after the work opens, as in the prototype. */
export const ONBOARDING_DELAY_MS = 700;

export type OnboardingClose = "finish" | "skip" | "dismiss";

const store = () => window.localStorage;

export function useEditorOnboarding() {
  const [locale, setLocale] = useState<InterfaceLocale>("hr");
  const [mode, setMode] = useState<"automatic" | "help" | null>(null);
  const openedFromHelp = useRef(false);
  const key = useRef<string | null>(null);

  useEffect(() => {
    const root = document.documentElement;
    const read = () => setLocale(parseInterfaceLocale(root.lang));
    const observer = new MutationObserver(read);
    observer.observe(root, { attributes: true, attributeFilter: ["lang"] });
    read();
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    void readJournalScope().then((read) => {
      if (!active || read.kind !== "scope") return;
      const own = onboardingKey(read.scope);
      key.current = own;
      if (onboardingSeen(own, store)) return;
      timer = setTimeout(() => {
        if (active && !openedFromHelp.current && !onboardingSeen(own, store)) setMode("automatic");
      }, ONBOARDING_DELAY_MS);
    }).catch(() => { /* The guide remains available from Help. */ });
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, []);

  return {
    locale,
    mode,
    openFromHelp: () => {
      openedFromHelp.current = true;
      setMode("help");
    },
    /** Finishing or skipping marks the guide seen; Esc only closes it, so it comes back next time. */
    close: (how: OnboardingClose = "dismiss") => {
      if (how !== "dismiss" && key.current !== null) markOnboardingSeen(key.current, store);
      setMode(null);
    },
  };
}
