import { createElement as h } from "react";

import styles from "./RouteLoading.module.css";

/**
 * #732 item 4: the body a route shows while its page reads the database, in
 * the pattern of app/zadatak/[id]/loading.tsx; the loading.tsx puts it under
 * the plain AppHeader. Not AppShell: the fallback has no session to mark for
 * the other tabs (SessionObserver, D-118), so it reads none and claims none.
 * Written with createElement, like the other screens tested by static render.
 * Moved from the web's shell (WEB-06). VIZ-0: the prototype's loading state
 * (E-2 "učitavanje"): grey bars over two item frames, the label read out by
 * the status and hidden from sight, as in the prototype.
 */
export function RouteLoading({ label }: { label: string }) {
  const bar = (width: "w40" | "w60" | "w80") => h("span", { className: `${styles.bar} ${styles[width]}` });
  return h(
    "main",
    { id: "sadrzaj", tabIndex: -1, className: `page ${styles.screen}`, "aria-busy": "true" },
    h("p", { role: "status" }, label),
    h("div", { "aria-hidden": "true", className: styles.column },
      bar("w40"),
      h("span", { className: styles.item }, bar("w80"), bar("w60")),
      h("span", { className: styles.item }, bar("w80"), bar("w40"))),
  );
}
