"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@ductura/ui";

import { startWorkCall, startWorkOnce, type StartedWork, type StartWorkTransport } from "../../../../../../src/client/student-work";
import { nextPath } from "../../../bases";
import { useHost } from "../../context";
import { startWorkText as t } from "./messages.hr";
import { stepFor, workFacts } from "./model";
import { readTemplate } from "./template-port";
import { templateBlocks, type TemplateRead } from "./template";
import styles from "./StartWork.module.css";

const defaultRead = (id: string) => readTemplate(id);
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
export function StartWork({ assignmentId, title, call = defaultCall, onOpened, template = defaultRead }: {
  assignmentId: string;
  title: string;
  call?: () => StartWorkTransport;
  onOpened?: () => void;
  template?: (assignmentId: string) => Promise<TemplateRead>;
}) {
  const { base } = useHost();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [opened, setOpened] = useState<StartedWork | null>(null);
  const [tpl, setTpl] = useState<TemplateRead | null>(null);
  const [note, setNote] = useState<string | null>(null);

  // The skeleton is read when the card mounts, so the student sees it before starting
  // (after the start this component is replaced by the editor); the start never waits for it.
  useEffect(() => {
    let live = true;
    void template(assignmentId).catch((): TemplateRead => ({ kind: "unavailable" })).then((read) => { if (live) setTpl(read); });
    return () => { live = false; };
  }, [assignmentId, template]);

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
      {tpl === null || tpl.kind === "none" ? null : tpl.kind === "ready" ? (
        <div role="status">
          <p className={styles.facts}>{t.template.replace("{version}", String(tpl.template.version)).replace("{sections}", String(tpl.template.sections.length))}</p>
          <ul className={styles.skeleton}>
            {/* An empty hint is an empty paragraph in the editor, but no line in this preview. */}
            {templateBlocks(tpl.template, t.titleFields).filter((b) => (b.content?.[0]?.text ?? "") !== "").map((b, k) => (
              <li key={k}>{b.type === "heading" ? <strong>{b.content?.[0]?.text}</strong> : b.content?.[0]?.text}</li>
            ))}
          </ul>
        </div>
      ) : (
        <p className={styles.facts} role="status">{tpl.kind === "signedOut" ? t.templateSignedOut : t.templateUnavailable}</p>
      )}
      {note === null ? null : <p className={styles.note} role="alert">{note}</p>}
    </div>
  );
}
