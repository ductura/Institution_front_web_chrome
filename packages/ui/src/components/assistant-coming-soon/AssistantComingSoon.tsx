import { Tag } from "../Tag";
import styles from "./AssistantComingSoon.module.css";

export type AssistantComingSoonLabels = {
  /** Heading of the card. */
  title: string;
  /** The visible "soon" badge; the text carries the meaning. */
  badge: string;
  /** What the pilot state means for the student. */
  body: string;
  /** Heading of the purposes list. */
  purposesTitle: string;
  /** Accessible name of the purposes list. */
  purposesList: string;
};

export type AssistantComingSoonProps = {
  labels: AssistantComingSoonLabels;
  /** Purposes shown as plain, non-interactive text. */
  purposes: readonly string[];
};

/**
 * "Coming soon" card of the assistant panel (C-13). Pure markup: no input, no key field,
 * no button, no route and no request. The app passes the texts.
 */
export function AssistantComingSoon({ labels, purposes }: AssistantComingSoonProps) {
  return (
    <section className={styles.card} data-assistant-state="coming-soon">
      <p className={styles.head}>
        <strong className={styles.title}>{labels.title}</strong>
        <Tag>{labels.badge}</Tag>
      </p>
      <p className={styles.body}>{labels.body}</p>
      <h3 className={styles.sub}>{labels.purposesTitle}</h3>
      <ul className={styles.purposes} aria-label={labels.purposesList}>
        {purposes.map((purpose) => <li key={purpose} className={styles.purpose}>{purpose}</li>)}
      </ul>
    </section>
  );
}
