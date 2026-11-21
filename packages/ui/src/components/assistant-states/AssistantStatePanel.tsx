import { useId, type ReactNode } from "react";

import { Tag } from "../Tag";
import { InertButton } from "./InertButton";
import styles from "./AssistantStatePanel.module.css";

export type AssistantStateAction = { label: string; onClick: () => void; tone?: "primary" | "quiet" };

/** What every panel state shares; the app passes all texts. */
export type AssistantStateCommonProps = {
  /** A check or retry is running: actions wait and the busy text is announced. */
  busy?: boolean;
  /** The panel is switched off around this state: actions stay focusable but do nothing. */
  disabled?: boolean;
  /** A failure of the panel's own action (for example a retry), announced as an alert. */
  error?: string;
  /**
   * Content kept under the notice, such as an earlier, read-only conversation and its
   * (disabled) transfer action. Transfer itself is not part of these components.
   */
  children?: ReactNode;
};

type PanelProps = AssistantStateCommonProps & {
  state: string;
  title: string;
  tag?: string;
  message: string;
  /** "status" for a calm notice, "alert" for a failure the student must notice. */
  tone: "status" | "alert";
  busyText: string;
  disabledText: string;
  actions?: readonly AssistantStateAction[];
};

/** The frame every assistant panel state uses (s16, states 7 to 12). Not exported from the package. */
export function AssistantStatePanel({
  state, title, tag, message, tone, busyText, disabledText, actions = [], busy, disabled, error, children,
}: PanelProps) {
  const reason = useId();
  const inert = Boolean(disabled);
  return (
    <section className={styles.panel} data-assistant-state={state} aria-busy={busy || undefined}>
      <header className={styles.top}>
        <h2 className={styles.title}>{title}</h2>
        {tag ? <Tag>{tag}</Tag> : null}
      </header>
      <p className={tone === "alert" ? styles.alert : styles.status} role={tone}>{message}</p>
      {children ? <div className={styles.slot}>{children}</div> : null}
      {error ? <p className={styles.alert} role="alert">{error}</p> : null}
      <p className={styles.meta} role="status">{busy ? busyText : ""}</p>
      {inert ? <p className={styles.meta} id={reason}>{disabledText}</p> : null}
      {actions.length > 0 ? (
        <div className={styles.actions}>
          {actions.map((action) => (
            <InertButton key={action.label} tone={action.tone} onClick={action.onClick}
              inert={inert} busy={busy} describedBy={inert ? reason : undefined}>
              {action.label}
            </InertButton>
          ))}
        </div>
      ) : null}
    </section>
  );
}
