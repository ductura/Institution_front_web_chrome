"use client";

import { Button, Dialog } from "@ductura/ui";

import { messagesHr } from "../../lib/i18n/messages.hr";

const t = messagesHr.submit;

export type SubmitDialogProps = {
  readonly open: boolean;
  /** The revision on the page: the one the request sends. */
  readonly revision: number;
  /** The deadline has passed: the receipt will say so (variant nakonroka). */
  readonly late: boolean;
  readonly sending: boolean;
  readonly onSubmit: () => void;
  readonly onClose: () => void;
  /** False only in the catalogue, where the dialog stands in the page like the Dialog entry. */
  readonly modal?: boolean;
};

/**
 * PD-3 "Predati rad?" (WEB-26). While the submission is on its way both
 * buttons do nothing and Escape does not close the dialog: the answer decides
 * what the page says next, never the dialog.
 */
export function SubmitDialog({ open, revision, late, sending, onSubmit, onClose, modal = true }: SubmitDialogProps) {
  return (
    <Dialog open={open} modal={modal} title={t.dialogTitle} onClose={onClose} dismissible={!sending}
      actions={(
        <>
          <Button busy={sending} onClick={onSubmit}>{sending ? t.sending : t.submit}</Button>
          <Button tone="quiet" busy={sending} onClick={onClose}>{t.cancel}</Button>
        </>
      )}>
      <p>{`${t.dialogText} ${t.revision}: ${revision}.`}</p>
      {late && <p>{t.dialogLate}</p>}
      {sending && <p role="status">{t.sending}</p>}
    </Dialog>
  );
}
