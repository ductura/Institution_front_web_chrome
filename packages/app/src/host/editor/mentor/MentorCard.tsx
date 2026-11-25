"use client";

// WEB-2137 (PARITET Mentor, prototype mentor2): state of the work, the badge, "Sljedeća etapa", preparation
// for a consultation, "Kako mentor radi" and the abstract row. The caller owns every read (state, messages,
// slots, milestones) and passes `null` for what the server does not give yet: the card then says
// "nedostupno". The collaborator only reads. Actions are drawn only when the caller wires them.
import { Button, Details } from "@ductura/ui";
import { useState, type ReactNode } from "react";

import type { ConsultationSlot } from "../../../../../../src/client/consultation-slots";
import type { WorkMessage } from "../../../../../../src/client/work-messages";
import type { WorkMilestone } from "../../../../../../src/client/work-milestones";

import styles from "./Mentor.module.css";
import { absStatus, badgeCount, badgeText, nextStageLine, prepText, stateView, type ActionId, type PrepInput, type Role, type WorkState } from "./mentor-model";
import { mentorCardHr as t } from "./messages.hr";

/** `undefined` = still reading; `null` = the server does not give it. */
type Read<T> = T | null | undefined;

export type MentorCardProps = {
  role: Role;
  now?: Date;
  state: Read<WorkState>;
  milestones: Read<readonly WorkMilestone[]>;
  messages: Read<readonly WorkMessage[]>;
  slots: Read<readonly ConsultationSlot[]>;
  /** ISO time the user last left the card; messages after it count as new. */
  seenAt: string | null;
  howText: Read<string>;
  words: number | null;
  prep: Read<PrepInput>;
  /** Consultations and criteria (ConsultPanel), mounted by the caller. */
  consult?: ReactNode;
  /** MK-8: "Što je mentor rekao" (SaidPanel), mounted by the caller under the state. */
  said?: ReactNode;
  /** MK-10: the composing preparation (PrepPanel); without it the card shows the given `prep` read-only. */
  prepPanel?: ReactNode;
  onAction?: (action: ActionId) => void;
  onOpenAbstract?: () => void;
  onCopyPrep?: (text: string) => Promise<boolean>;
};

export function MentorCard(p: MentorCardProps) {
  const now = p.now ?? new Date();
  const [copied, setCopied] = useState(false);
  const badge = p.messages && p.slots ? badgeText(badgeCount(p.role, p.messages, p.seenAt, p.slots)) : null;
  const view = p.state ? stateView(p.role, p.state, now) : null;
  const next = p.milestones && p.state?.kind !== "submitted" ? nextStageLine(p.milestones, now) : null;
  const canAct = p.role !== "collaborator" && p.onAction !== undefined;
  const text = p.prep ? prepText(p.prep) : null;

  return (
    <div className={styles.card} data-mentor-card="">
      <div className={styles.head}>
        <h3 className={styles.title}>{t.title}</h3>
        {badge !== null && <span className={styles.badge} role="status">{badge}</span>}
      </div>
      <section className={styles.stat} aria-label={t.stateLabel}>
        <p className={styles.sub}>{t.stateLabel}</p>
        {p.state === undefined ? <p role="status">{t.stateLoading}</p> : view === null ? <p role="status">{t.stateUnavailable}</p> : (
          <>
            <h4 role="status">{view.headline}</h4>
            {view.sub !== null && view.sub !== "" && <p className={styles.line}>{view.sub}</p>}
            {view.request !== null && <p className={styles.req}>{view.request}</p>}
            {canAct && view.actions.length > 0 && (
              <div className={styles.row}>
                {view.actions.map((a, i) => <Button key={a} size="dense" tone={i === 0 ? "primary" : "secondary"} onClick={() => p.onAction?.(a)}>{t.actions[a]}</Button>)}
              </div>
            )}
          </>
        )}
        {next !== null && <p className={styles.line}>{next}</p>}
      </section>
      {p.said}
      {p.consult}
      <Details className={styles.rpd} summary={t.prep.title}>
        {p.prepPanel !== undefined ? p.prepPanel : text === null ? <p>{p.prep === undefined ? t.stateLoading : t.prep.unavailable}</p> : (
          <>
            <p className={styles.muted}>{t.prep.intro}</p>
            <textarea className={styles.field} rows={9} readOnly aria-label={t.prep.title} value={text} />
            {p.onCopyPrep && (
              <Button tone="secondary" size="dense" onClick={() => { void p.onCopyPrep?.(text).then((ok) => setCopied(ok)); }}>{t.prep.copy}</Button>
            )}
            {copied && <p role="status">{t.prep.copied}</p>}
          </>
        )}
      </Details>
      <Details className={styles.rpd} summary={t.how.title}>
        <p>{p.howText === undefined ? t.stateLoading : p.howText === null ? t.how.unavailable : p.howText.trim() === "" ? t.how.empty : p.howText}</p>
      </Details>
      <div className={styles.abs}>
        <span>{t.abs.title}: {absStatus(p.words)} · {t.abs.where}</span>
        {p.onOpenAbstract && <Button tone="secondary" size="dense" onClick={p.onOpenAbstract}>{t.abs.open}</Button>}
      </div>
    </div>
  );
}
