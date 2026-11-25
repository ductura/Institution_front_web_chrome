"use client";

import { useEffect, useRef, useState } from "react";

import { scopeSaid, scopeStanding, type ScopeRange, type ScopeStanding } from "./StatusBar";
import styles from "./StatusBar.module.css";

/**
 * ED-04 (NF2-P6): says only the crossing of a limit of the assignment's range. Opening the work,
 * a count still loading and typing inside one band say nothing. A polite region of its own and not
 * a status role, so the bar's save region stays the one status there.
 */
export function ScopeAnnounce({ words, range }: { words: number | null; range: ScopeRange }) {
  const standing = scopeStanding(words, range);
  const last = useRef<ScopeStanding | null>(null);
  const [said, setSaid] = useState("");
  useEffect(() => {
    if (standing === null || words === null || range === null) return;
    if (last.current !== null && last.current !== standing) setSaid(scopeSaid(standing, words, range));
    last.current = standing;
  }, [standing, words, range]);
  return <span className={styles.said} aria-live="polite" aria-atomic="true">{said}</span>;
}
