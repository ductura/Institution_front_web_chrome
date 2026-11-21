"use client";

import { Button, Dialog } from "@ductura/ui";
import { useRef, useState } from "react";

import { leaveFor, signOut } from "@/client/api";
import { clearSubmissionStorage } from "@/components/predaja/storage";
import { messagesHr as t } from "@/lib/i18n/messages.hr";

/**
 * WEB-08 (A-6): "Odjava" in the shell opens the shared dialog (WEB-04); on
 * confirmation auth.logout.post ends the Ductura session and the AAI@EduHr
 * session, and the browser goes to "/". Without the server's confirmation
 * nothing has ended: the dialog says so and offers it again (F-285).
 */
export default function ShellSignOut({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const stayButton = useRef<HTMLButtonElement>(null);

  const close = () => {
    if (busy) return;
    setOpen(false);
    setFailed(false);
  };
  const confirm = async () => {
    setBusy(true);
    setFailed(false);
    if (await signOut()) {
      clearSubmissionStorage();
      leaveFor("/");
      return;
    }
    setBusy(false);
    setFailed(true);
  };

  return (
    <>
      <Button tone="quiet" className={className} onClick={() => setOpen(true)}>
        {t.shell.signOut}
      </Button>
      <Dialog
        open={open}
        title={t.auth.logoutTitle}
        onClose={close}
        dismissible={!busy}
        initialFocus={stayButton}
        error={failed ? t.auth.logoutUnconfirmed : undefined}
        actions={
          <>
            <Button ref={stayButton} tone="quiet" onClick={close} disabled={busy}>
              {t.auth.logoutStay}
            </Button>
            <Button busy={busy} onClick={() => void confirm()}>
              {busy ? t.auth.loggingOut : t.auth.logoutConfirm}
            </Button>
          </>
        }
      >
        <p>{t.signInState.logoutBody}</p>
      </Dialog>
    </>
  );
}
