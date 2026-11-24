"use client";

// ED-09 (NF2-P9): "Pravila za ovaj zadatak" below the Asistent card, as in the prototype's
// aiCard: the policy in bold, every purpose with ✓ or × (the sign is hidden, the words are read),
// the line about tools outside Ductura, and the way to the notice and to the declaration.
import { appHref } from "../../../../../../src/components/index.ts";
import { assistantRulesHr as t } from "./messages.hr";
import { declarationPath, instructionsOf, noticePath, rulesViewOf, useAssignmentNotice, type RulesView } from "./assistant-rules";
import styles from "./AssistantRules.module.css";

export function AssistantRulesView({ view, noticeHref, declarationHref }: { view: RulesView; noticeHref: string; declarationHref: string }) {
  return (
    <section className={styles.rules} aria-labelledby="ed09-rules-title" data-assistant-rules={view.kind}>
      <h3 id="ed09-rules-title" className={styles.title}>{t.title}</h3>
      <div className={styles.card} aria-busy={view.kind === "loading" || undefined}>
        {view.kind === "loading" ? <p role="status" className={styles.muted}>{t.loading}</p> : null}
        {view.kind === "unavailable" ? <p role="status" className={styles.muted}>{t.unavailable}</p> : null}
        {view.kind === "rules" ? <>
          <p className={styles.policy}><b>{view.policy}</b></p>
          {view.purposes === null ? <p className={styles.none}>{t.none}</p> : (
            <ul className={styles.list}>
              {view.purposes.map((p) => (
                <li key={p.key} className={styles.purpose} data-allowed={p.allowed}>
                  <span className={p.allowed ? styles.yes : styles.no} aria-hidden="true">{p.allowed ? "✓" : "×"}</span>
                  <span>{p.label}<span className={styles.sr}> · {p.allowed ? t.allowed : t.notAllowed}</span></span>
                </li>
              ))}
            </ul>
          )}
        </> : null}
      </div>
      <p className={styles.muted}>{t.outside}</p>
      <div className={styles.links}>
        <a className={styles.btn} href={noticeHref}>{t.readNotice}</a>
        <a className={styles.btn} href={declarationHref}>{t.declaration}</a>
      </div>
    </section>
  );
}

export function AssistantRules({ assignmentId, base }: { assignmentId: string; base: string }) {
  const read = useAssignmentNotice(assignmentId);
  return <AssistantRulesView view={rulesViewOf(read)}
    noticeHref={appHref(base, noticePath(assignmentId))} declarationHref={appHref(base, declarationPath(assignmentId))} />;
}

/** ED-09: the instructions of the assignment in "Prvi redak", as the teacher wrote them; nothing while they cannot be read. */
export function NoticeInstructions({ assignmentId }: { assignmentId: string }) {
  const text = instructionsOf(useAssignmentNotice(assignmentId));
  return text === null ? null : <p className={styles.instructions}>{text}</p>;
}
