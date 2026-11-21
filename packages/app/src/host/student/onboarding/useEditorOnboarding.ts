"use client";

import { useEffect, useRef, useState } from "react";

import { readJournalScope } from "../../../../../../src/components/editor/EditorPage.scope";
import { parseInterfaceLocale, type InterfaceLocale } from "../../../../../../src/lib/i18n/locale";
import { claimOnboarding, onboardingKey } from "./seen";

export function useEditorOnboarding() {
  const [locale, setLocale] = useState<InterfaceLocale>("hr");
  const [mode, setMode] = useState<"automatic" | "help" | null>(null);
  const openedFromHelp = useRef(false);

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
    void readJournalScope().then(async (read) => {
      if (!active || read.kind !== "scope") return;
      const key = onboardingKey(read.scope);
      const show = () => {
        if (!active) return;
        if (claimOnboarding(key, () => window.localStorage) && !openedFromHelp.current) setMode("automatic");
      };
      if (navigator.locks) await navigator.locks.request(key, show);
      else show();
    }).catch(() => { /* The guide remains available from Help. */ });
    return () => { active = false; };
  }, []);

  return {
    locale,
    mode,
    openFromHelp: () => {
      openedFromHelp.current = true;
      setMode("help");
    },
    close: () => setMode(null),
  };
}
