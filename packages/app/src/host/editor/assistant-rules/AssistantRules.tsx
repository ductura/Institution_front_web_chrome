"use client";

// ED-09 (NF2-P9): "Pravila za ovaj zadatak" below the Asistent card, as in the prototype's
// aiCard: the policy in bold, every purpose with ✓ or × (the sign is hidden, the words are read),
// the line about tools outside Ductura, and the way to the notice and to the declaration.
// ED-12 (NF2-P12, dio a): "Izjava o korištenju alata" opens the declaration's dialog in place, so the
// student keeps their place in the text; filling it in stays on its page ("Uredi izjavu").
import { useState } from "react";

import { goToSignIn } from "../../../../../../src/client/api";
import { appHref } from "../../../../../../src/components/index.ts";
import DeclarationDialog from "../../student/submission/declaration/DeclarationDialog";
import { assistantRulesHr as t } from "./messages.hr";
import { declarationPath, instructionsOf, noticePath, rulesViewOf, useAssignmentNotice, workPath, type RulesView } from "./assistant-rules";
import styles from "./AssistantRules.module.css";

export function AssistantRulesView({ view, noticeHref, declarationHref, onDeclaration }: {
  view: RulesView; noticeHref: string; declarationHref: string;
  /** Opens the declaration's dialog; without it the declaration is a link to its page. */
  onDeclaration?: () => void;
}) {
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
        {onDeclaration === undefined ? <a className={styles.btn} href={declarationHref}>{t.declaration}</a> : <>
          <button type="button" className={styles.btn} aria-haspopup="dialog" onClick={onDeclaration}>{t.declaration}</button>
          <a className={styles.btn} href={declarationHref}>{t.editDeclaration}</a>
        </>}
      </div>
    </section>
  );
}

export function AssistantRules({ assignmentId, base }: { assignmentId: string; base: string }) {
  const read = useAssignmentNotice(assignmentId);
  const [declaring, setDeclaring] = useState(false);
  return <>
    <AssistantRulesView view={rulesViewOf(read)} noticeHref={appHref(base, noticePath(assignmentId))}
      declarationHref={appHref(base, declarationPath(assignmentId))} onDeclaration={() => setDeclaring(true)} />
    {/* The shared Dialog puts the focus back on the button that opened it. */}
    <DeclarationDialog assignmentId={assignmentId} open={declaring} onClose={() => setDeclaring(false)}
      onSignIn={() => goToSignIn(appHref(base, workPath(assignmentId)))} />
  </>;
}

/** ED-09: the instructions of the assignment in "Prvi redak", as the teacher wrote them; nothing while they cannot be read. */
export function NoticeInstructions({ assignmentId }: { assignmentId: string }) {
  const text = instructionsOf(useAssignmentNotice(assignmentId));
  return text === null ? null : <p className={styles.instructions}>{text}</p>;
}
