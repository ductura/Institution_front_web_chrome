"use client";

import { useState } from "react";

import { appHref } from "../../../../src/components/index.ts";
import { leaveFor } from "../../../../src/client/api.ts";
import { browserSignOutDeps, signOutHere } from "../../../../src/client/logout-request";

import { useLocale } from "../i18n";
import type { Base } from "../bases";
import { EditorSignOutOutlet } from "./editor/save-status/SignOutSlot";
import styles from "./SignOut.module.css";

/** "Postavke profila" (WEB-1804) and "Odjava": auth.logout.post, then the preloader. */
export default function SignOut({ base }: { base: Base }) {
  const { t, app } = useLocale();
  const [state, setState] = useState<"idle" | "busy" | "failed">("idle");
  const onClick = async () => {
    setState("busy");
    if (await signOutHere(null, browserSignOutDeps())) leaveFor("/");
    else setState("failed");
  };
  return (
    <EditorSignOutOutlet>
      <a className={styles.signOut} href={appHref(base, "/profil")}>{app.profile.open}</a>
      <button type="button" className={styles.signOut} onClick={() => void onClick()} disabled={state === "busy"}>
        {state === "busy" ? t.auth.loggingOut : t.shell.signOut}
      </button>
      {state === "failed" ? <p role="alert" className={styles.failed}>{app.host.signOutFailed}</p> : null}
    </EditorSignOutOutlet>
  );
}
