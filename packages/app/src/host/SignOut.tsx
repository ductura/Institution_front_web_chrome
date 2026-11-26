"use client";

import { useRef, useState } from "react";

import { Button, Dialog } from "@ductura/ui";

import { appHref } from "../../../../src/components/index.ts";
import { browserSignOutDeps, followLogoutNatively, signOutHere } from "../../../../src/client/logout-request";

import { useLocale } from "../i18n";
import type { Base } from "../bases";
import { EditorSignOutOutlet } from "./editor/save-status/SignOutSlot";
import styles from "./SignOut.module.css";

/**
 * "Odjava" with its dialog (A-6, E-0 R-3): the button opens it, the person
 * confirms, auth.logout.post ends the Ductura session, and the browser then
 * follows the route natively on to the AAI@EduHr logout and back to "/"
 * (INT-20c: a script request cannot follow that redirect, so the provider session
 * would outlive the sign-out). Without the server's confirmation nothing has
 * ended: the dialog says so and offers it again (F-285). Esc, the backdrop and
 * "Ostani" close it; while the request runs nothing closes it.
 */
export function SignOutDialogButton({ className, label }: { className?: string; label?: string }) {
  const { t, work, app } = useLocale();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [all, setAll] = useState(false);
  const stay = useRef<HTMLButtonElement>(null);

  const close = () => {
    if (busy) return;
    setOpen(false);
    setFailed(false);
  };
  const confirm = async (everywhere: boolean) => {
    setAll(everywhere);
    setBusy(true);
    setFailed(false);
    if (await signOutHere(null, browserSignOutDeps(everywhere))) {
      // The provider logout is followed through the plain logout route in both
      // cases: it works without the cookie the route above just cleared.
      followLogoutNatively();
      return;
    }
    setBusy(false);
    setFailed(true);
  };
  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)}>{label ?? t.shell.signOut}</button>
      <Dialog
        open={open}
        title={work.auth.logoutTitle}
        onClose={close}
        dismissible={!busy}
        initialFocus={stay}
        error={failed ? app.host.signOutFailed : undefined}
        actions={
          <>
            <Button ref={stay} tone="quiet" onClick={close} disabled={busy}>{work.auth.logoutStay}</Button>
            <Button tone="quiet" busy={busy && all} onClick={() => void confirm(true)} disabled={busy}>{busy && all ? work.auth.loggingOut : app.host.signOutAll}</Button>
            <Button busy={busy && !all} onClick={() => void confirm(false)} disabled={busy}>{busy && !all ? work.auth.loggingOut : work.auth.logoutConfirm}</Button>
          </>
        }
      >
        <p>{work.signInState.logoutBody}</p>
      </Dialog>
    </>
  );
}

/** "Postavke profila" (WEB-1804) and "Odjava" with its dialog, in the shell's account place. */
export default function SignOut({ base }: { base: Base }) {
  const { app } = useLocale();
  return (
    <EditorSignOutOutlet>
      <a className={styles.signOut} href={appHref(base, "/profil")}>{app.profile.open}</a>
      <SignOutDialogButton className={styles.signOut} />
    </EditorSignOutOutlet>
  );
}
