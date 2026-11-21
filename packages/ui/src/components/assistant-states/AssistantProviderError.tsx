import { AssistantStatePanel, type AssistantStateCommonProps } from "./AssistantStatePanel";

export type AssistantProviderErrorLabels = {
  title: string;
  /** Optional short tag next to the title. */
  tag?: string;
  message: string;
  busy: string;
  disabled: string;
  retry: string;
  close: string;
};

export type AssistantProviderErrorProps = AssistantStateCommonProps & {
  labels: AssistantProviderErrorLabels;
  onRetry: () => void;
  onClose: () => void;
};

/** The assistant service did not answer; nothing was transferred into the work (s16, state 10). */
export function AssistantProviderError({ labels, onRetry, onClose, ...common }: AssistantProviderErrorProps) {
  return (
    <AssistantStatePanel
      state="provider-error"
      tone="alert"
      title={labels.title}
      tag={labels.tag}
      message={labels.message}
      busyText={labels.busy}
      disabledText={labels.disabled}
      actions={[{ label: labels.retry, onClick: onRetry }, { label: labels.close, onClick: onClose, tone: "quiet" as const }]}
      {...common}
    />
  );
}
