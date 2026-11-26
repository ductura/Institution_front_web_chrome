"use client";

import { Button } from "@ductura/ui";
import { useState } from "react";

import { deadlinesIcs, exportable, ICS_FILE } from "./calendar";
import styles from "./Home.module.css";
import { homeText as t } from "./messages.hr";
import type { TaskRow } from "./model";

/** Hands the text to the browser as a file; nothing leaves the browser. */
function saveFile(text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: "text/calendar;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = ICS_FILE;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/**
 * F4-STU-R12 (NF-1 P-14, E-2f, R-49): under "Moji zadaci", "Dodaj rokove u kalendar" saves `ductura-rokovi.ics`
 * with the deadlines of the unsubmitted tasks. With none left the button stays focusable but dimmed and says why.
 */
export function DeadlinesExport({ rows, save = saveFile }: { rows: readonly TaskRow[]; save?: (text: string) => void }) {
  const [said, setSaid] = useState("");
  const open = exportable(rows).length > 0;
  const run = () => {
    const file = deadlinesIcs(rows, Date.now());
    if (file === null) { setSaid(t.icsNone); return; }
    try {
      save(file.text);
      setSaid(t.icsDone.replace("{n}", String(file.count)));
    } catch {
      setSaid(t.icsFailed);
    }
  };
  return (
    <div className={styles.ics}>
      <Button tone="secondary" aria-disabled={!open || undefined} aria-describedby="po-ics-n" onClick={run}>{t.icsButton}</Button>
      <span className={styles.meta} id="po-ics-n">{open ? t.icsNote : t.icsAllSubmitted}</span>
      <p className={styles.meta} role="status">{said}</p>
    </div>
  );
}
