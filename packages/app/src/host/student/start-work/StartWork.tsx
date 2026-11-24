"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@ductura/ui";

import { startWorkCall, startWorkOnce, type StartedWork, type StartWorkTransport } from "../../../../../../src/client/student-work";
import { nextPath } from "../../../bases";
import { useHost } from "../../context";
import { startWorkText as t } from "./messages.hr";
import { stepFor, workFacts } from "./model";
import styles from "./StartWork.module.css";

const defaultCall = () => startWorkCall();

/**
 * "Započni rad" on the card of one assignment (WEB-1402, plan M2.1). The click
 * calls the start route through src/client; only the server's answer opens the
 * editor (B-6), and it names the language of the work and the version of the
 * faculty rules, shown here while the editor opens. A second click, or a click
 * while the first is in flight, opens the same work: the client sends one call
 * at a time and the server makes one work per student and assignment.
 * `call` is for tests; the page uses the client.
 * On the work page itself the editor's address is the one already open, and
 * going there again would not read the work again (INT-31): that page passes
 * `onOpened`, which reads it again in place of going to the editor.
 */
export function StartWork({ assignmentId, title, call = defaultCall, onOpened }: {
  assignmentId: string;
  title: string;
  call?: () => StartWorkTransport;
  onOpened?: () => void;
}) {
  const { base } = useHost();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [opened, setOpened] = useState<StartedWork | null>(null);
  const [note, setNote] = useState<string | null>(null);

  async function start() {
    if (busy) return;
    setBusy(true);
    setNote(null);
    const step = stepFor(await startWorkOnce(call(), assignmentId), assignmentId);
    if (step.kind === "note") {
      setBusy(false);
      setNote(step.text);
      return;
    }
    if (step.kind === "open") setOpened(step.work);
    // Busy stays on until the page leaves (or reads the work again), so the opening editor is not asked twice.
    if (step.kind === "open" && onOpened) return onOpened();
    router.push(nextPath(base, step.route));
  }

  return (
    <div className={styles.start}>
      <Button busy={busy} onClick={() => void start()} aria-label={t.startFor.replace("{title}", title)}>
        {busy ? t.starting : t.start}
      </Button>
      <p className={styles.facts} role="status">
        {opened === null ? null : `${t.opened} ${workFacts(opened).join(". ")}.`}
      </p>
      {note === null ? null : <p className={styles.note} role="alert">{note}</p>}
    </div>
  );
}
