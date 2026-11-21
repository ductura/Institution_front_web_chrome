"use client";

import { useState } from "react";

import { appHref } from "../../../../src/components/index.ts";
import { leaveFor, signOut } from "../../../../src/client/api.ts";

import { useLocale } from "../i18n";
import type { Base } from "../bases";
import styles from "./SignOut.module.css";

/** "Postavke profila" (WEB-1804) and "Odjava": auth.logout.post, then the preloader. */
export default function SignOut({ base }: { base: Base }) {
  const { t, app } = useLocale();
  const [state, setState] = useState<"idle" | "busy" | "failed">("idle");
  const onClick = async () => {
    setState("busy");
    if (await signOut()) leaveFor("/");
    else setState("failed");
  };
  return (
    <>
      <a className={styles.signOut} href={appHref(base, "/profil")}>{app.profile.open}</a>
      <button type="button" className={styles.signOut} onClick={() => void onClick()} disabled={state === "busy"}>
        {state === "busy" ? t.auth.loggingOut : t.shell.signOut}
      </button>
      {state === "failed" ? <p role="alert" className={styles.failed}>{app.host.signOutFailed}</p> : null}
    </>
  );
}
