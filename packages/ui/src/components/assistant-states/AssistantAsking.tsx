import { AssistantStatePanel, type AssistantStateCommonProps } from "./AssistantStatePanel";

export type AssistantAskingLabels = {
  title: string;
  /** Optional short tag next to the title. */
  tag?: string;
  message: string;
  busy: string;
  disabled: string;
  answer: string;
};

export type AssistantAskingProps = AssistantStateCommonProps & {
  labels: AssistantAskingLabels;
  onAnswer: () => void;
};

/** Labels for the asking mode (s16, state 7): the assistant asks, the student answers; it writes no text for the work. */
export function AssistantAsking({ labels, onAnswer, ...common }: AssistantAskingProps) {
  return (
    <AssistantStatePanel
      state="asking"
      tone="status"
      title={labels.title}
      tag={labels.tag}
      message={labels.message}
      busyText={labels.busy}
      disabledText={labels.disabled}
      actions={[{ label: labels.answer, onClick: onAnswer }]}
      {...common}
    />
  );
}
