"use client";

import { useContext } from "react";
import { createPortal } from "react-dom";

import { LocalLogout } from "@/components/editor/LocalDocument";
import { leaveFor, LOGOUT_PATH } from "@/client/api";
import { browserMarkStore, hasEnded, type SessionMark } from "@/client/session-marks";

import styles from "../../SignOut.module.css";
import { copyStorage, keepExitCopy } from "./recovery";
import { SignOutSlot } from "./SignOutSlot";

export function EditorSessionControls({ scope, session, assignmentId }: {
  scope: string;
  session: SessionMark;
  assignmentId: string;
}) {
  const target = useContext(SignOutSlot)?.target;
  return (
    <LocalLogout
      buttonClassName={styles.signOut}
      action={LOGOUT_PATH}
      afterSignOut={() => leaveFor("/")}
      renderTrigger={(trigger) => target ? createPortal(trigger, target) : null}
      keepCopy={(text) => {
        if (hasEnded(browserMarkStore(), session)) return false;
        return keepExitCopy(copyStorage(), scope, { assignmentId, at: Date.now(), text });
      }}
    />
  );
}
