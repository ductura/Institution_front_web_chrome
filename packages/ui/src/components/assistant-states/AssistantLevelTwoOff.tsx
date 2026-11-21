import { AssistantStatePanel, type AssistantStateCommonProps } from "./AssistantStatePanel";

export type AssistantLevelTwoOffLabels = {
  title: string;
  /** Optional short tag next to the title. */
  tag?: string;
  message: string;
  busy: string;
  disabled: string;
  close: string;
};

export type AssistantLevelTwoOffProps = AssistantStateCommonProps & {
  labels: AssistantLevelTwoOffLabels;
  onClose: () => void;
};

/** A level 2 purpose that the task's teacher has not switched on (s16, state 8). */
export function AssistantLevelTwoOff({ labels, onClose, ...common }: AssistantLevelTwoOffProps) {
  return (
    <AssistantStatePanel
      state="level-two-off"
      tone="status"
      title={labels.title}
      tag={labels.tag}
      message={labels.message}
      busyText={labels.busy}
      disabledText={labels.disabled}
      actions={[{ label: labels.close, onClick: onClose }]}
      {...common}
    />
  );
}
