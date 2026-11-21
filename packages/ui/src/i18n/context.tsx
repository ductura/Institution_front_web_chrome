"use client";

import { createContext, useContext } from "react";

import { DEFAULT_UI_LOCALE, type UiLocale } from "./locale";

/**
 * The interface language a page is shown in. The app's provider sets it;
 * without one every component reads Croatian, the default (D-70).
 */
export const UiLocaleContext = createContext<UiLocale>(DEFAULT_UI_LOCALE);

export function useUiLocale(): UiLocale {
  return useContext(UiLocaleContext);
}
