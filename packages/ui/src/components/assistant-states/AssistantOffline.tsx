import { AssistantStatePanel, type AssistantStateCommonProps } from "./AssistantStatePanel";

export type AssistantOfflineLabels = {
  title: string;
  /** Optional short tag next to the title. */
  tag?: string;
  message: string;
  busy: string;
  disabled: string;
};

export type AssistantOfflineProps = AssistantStateCommonProps & {
  labels: AssistantOfflineLabels;
};

/** No network: the conversation is read from this device and nothing can be transferred (s16, state 11). */
export function AssistantOffline({ labels, ...common }: AssistantOfflineProps) {
  return (
    <AssistantStatePanel
      state="offline"
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
