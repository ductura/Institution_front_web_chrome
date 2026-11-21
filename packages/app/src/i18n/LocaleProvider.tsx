"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { DEFAULT_UI_LOCALE, htmlLang, UiLocaleContext, type UiLocale } from "@ductura/ui";

import { createApi } from "../../../../src/client/api.ts";

import { cataloguesFor, type Catalogues } from "./catalogue";
import { readInterfaceLocale, readStoredLocale, saveInterfaceLocale, storeLocale, type LocaleCall, type LocaleSave } from "./interface-locale";

export type LocaleValue = Catalogues & {
  readonly locale: UiLocale;
  /** Whether the server's saved value has been read: "unread" until then, "failed" when it could not be. */
  readonly server: "unread" | "read" | "failed";
  /** Saves the language on the server and, once saved, shows every screen of the provider in it, without a new sign-in. */
  readonly setLocale: (locale: UiLocale) => Promise<LocaleSave>;
  /** Reads the saved language from the server once per page load; the host calls it after the session is read. */
  readonly syncFromServer: () => void;
};

const LocaleContext = createContext<LocaleValue | null>(null);

function storage(): Storage | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

const liveCall: LocaleCall = (id, input) => createApi()(id, input as never) as ReturnType<LocaleCall>;

/**
 * The interface language of everything under app/[base]/ (D-70, M11.5). It
 * starts in Croatian, as the server rendered it, takes the browser's copy of
 * the saved language on mount and the server's value once the host has read
 * the session. A change is saved through `profile.interface-locale.post` and
 * then shown at once: the session and the page stay as they are.
 */
export function LocaleProvider({ children, call = liveCall }: { children: ReactNode; call?: LocaleCall }) {
  const [locale, setState] = useState<UiLocale>(DEFAULT_UI_LOCALE);
  const [server, setServer] = useState<LocaleValue["server"]>("unread");
  const asked = useRef(false);

  useEffect(() => {
    const stored = readStoredLocale(storage());
    if (stored !== null) setState(stored);
  }, []);

  useEffect(() => {
    document.documentElement.lang = htmlLang(locale);
  }, [locale]);

  const syncFromServer = useCallback(() => {
    if (asked.current) return;
    asked.current = true;
    void readInterfaceLocale(call).then((read) => {
      if (read.kind !== "saved") {
        setServer("failed");
        return;
      }
      setServer("read");
      if (read.locale !== null) {
        setState(read.locale);
        storeLocale(storage(), read.locale);
      }
    });
  }, [call]);

  const setLocale = useCallback(async (next: UiLocale) => {
    const saved = await saveInterfaceLocale(call, next);
    if (saved.kind === "saved") {
      setState(saved.locale);
      setServer("read");
      storeLocale(storage(), saved.locale);
    }
    return saved;
  }, [call]);

  const value = useMemo<LocaleValue>(
    () => ({ ...cataloguesFor(locale), locale, server, setLocale, syncFromServer }),
    [locale, server, setLocale, syncFromServer],
  );
  return (
    <LocaleContext value={value}>
      <UiLocaleContext value={locale}>{children}</UiLocaleContext>
    </LocaleContext>
  );
}

const fallback: LocaleValue = {
  ...cataloguesFor(DEFAULT_UI_LOCALE),
  locale: DEFAULT_UI_LOCALE,
  server: "unread",
  setLocale: async () => ({ kind: "failed" }),
  syncFromServer: () => undefined,
};

/** The texts of the current interface language; Croatian outside the provider. */
export function useLocale(): LocaleValue {
  return useContext(LocaleContext) ?? fallback;
}
