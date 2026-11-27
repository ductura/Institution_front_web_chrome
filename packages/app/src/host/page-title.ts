"use client";

import { createContext, useContext, useEffect } from "react";

/** WEB-NASLOVI-SVE: where a page tells the host a tab title more exact than its route's label ("<naziv rada> — Pisanje"). */
export const PageTitleContext = createContext<(detail: string | null) => void>(() => undefined);

/** Sets the tab title's heading while the page is shown (null keeps the route's label); cleared when the page goes. */
export function usePageTitle(detail: string | null): void {
  const set = useContext(PageTitleContext);
  useEffect(() => {
    set(detail);
    return () => set(null);
  }, [set, detail]);
}

/** The public home page (/naslovnica) is titled by the app's name alone; every other page by its heading. */
export function headingFor(path: string | null, label: string | null): string | null {
  return path === "/naslovnica" ? null : label;
}

/** "<naziv rada> — <dio>": the heading of a work's page; null until the work's name is read. */
export function workTitle(name: string | null | undefined, part: string): string | null {
  const text = name?.trim() ?? "";
  return text === "" ? null : `${text} \u2014 ${part}`;
}
