import { AssistantStatePanel, type AssistantStateCommonProps } from "./AssistantStatePanel";

export type AssistantUnavailableLabels = {
  title: string;
  /** Optional short tag next to the title. */
  tag?: string;
  message: string;
  busy: string;
  disabled: string;
};

export type AssistantUnavailableProps = AssistantStateCommonProps & {
  labels: AssistantUnavailableLabels;
};

/** The assistant is not available on this task; writing and submission work without it (s16, state 9). */
export function AssistantUnavailable({ labels, ...common }: AssistantUnavailableProps) {
  return (
    <AssistantStatePanel
      state="unavailable"
      tone="status"
      title={labels.title}
      tag={labels.tag}
      message={labels.message}
      busyText={labels.busy}
      disabledText={labels.disabled}
      actions={[]}
      {...common}
    />
  );
}
