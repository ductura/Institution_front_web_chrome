"use client";

import { useState } from "react";

import { messagesHr as t } from "../../../../locales/hr.ts";
import { leaveFor } from "../../../../src/client/api.ts";
import { browserSignOutDeps, signOutHere } from "../../../../src/client/logout-request";

import { hostText } from "../text";
import { EditorSignOutOutlet } from "./editor/save-status/SignOutSlot";
import styles from "./SignOut.module.css";

/** "Odjava": auth.logout.post, then the preloader. */
export default function SignOut() {
  const [state, setState] = useState<"idle" | "busy" | "failed">("idle");
  const onClick = async () => {
    setState("busy");
    if (await signOutHere(null, browserSignOutDeps())) leaveFor("/");
    else setState("failed");
  };
  return (
    <EditorSignOutOutlet>
      <button type="button" className={styles.signOut} onClick={() => void onClick()} disabled={state === "busy"}>
        {state === "busy" ? t.auth.loggingOut : t.shell.signOut}
      </button>
      {state === "failed" ? <p role="alert" className={styles.failed}>{hostText.signOutFailed}</p> : null}
    </EditorSignOutOutlet>
  );
}
