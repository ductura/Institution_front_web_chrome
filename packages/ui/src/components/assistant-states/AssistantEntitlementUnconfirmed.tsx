import { AssistantStatePanel, type AssistantStateCommonProps } from "./AssistantStatePanel";

export type AssistantEntitlementUnconfirmedLabels = {
  title: string;
  /** Optional short tag next to the title. */
  tag?: string;
  message: string;
  busy: string;
  disabled: string;
  close: string;
};

export type AssistantEntitlementUnconfirmedProps = AssistantStateCommonProps & {
  labels: AssistantEntitlementUnconfirmedLabels;
  onClose: () => void;
};

/** Use of the assistant on this task is not confirmed, so a reply cannot be applied (s16, state 12). */
export function AssistantEntitlementUnconfirmed({ labels, onClose, ...common }: AssistantEntitlementUnconfirmedProps) {
  return (
    <AssistantStatePanel
      state="entitlement-unconfirmed"
      tone="alert"
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
