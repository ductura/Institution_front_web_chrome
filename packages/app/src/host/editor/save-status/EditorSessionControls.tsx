"use client";

import { useContext } from "react";
import { createPortal } from "react-dom";

import { LocalLogout } from "@/components/editor/LocalDocument";
import { LOGOUT_PATH } from "@/client/api";
import { browserMarkStore, hasEnded, type SessionMark } from "@/client/session-marks";

import styles from "../../SignOut.module.css";
import { exitCopyHr } from "./messages.hr";
import { copyStorage, keepExitCopy } from "./recovery";
import { InputRhythmHost } from "./InputRhythmHost";
import { SignOutSlot } from "./SignOutSlot";

export function EditorSessionControls({ scope, session, assignmentId, documentId }: {
  scope: string;
  session: SessionMark;
  assignmentId: string;
  /** The work being written; with it the rhythm of entry is recorded (PIL-P1-RITAM-EDITOR). */
  documentId?: string;
}) {
  const target = useContext(SignOutSlot)?.target;
  return (
    <>
    {documentId === undefined ? null : <InputRhythmHost documentId={documentId} />}
    <LocalLogout
      buttonClassName={styles.signOut}
      action={LOGOUT_PATH}
      unsavedWarning={exitCopyHr.warning}
      renderTrigger={(trigger) => target ? createPortal(trigger, target) : null}
      keepCopy={(text) => {
        if (hasEnded(browserMarkStore(), session)) return false;
        return keepExitCopy(copyStorage(), scope, { assignmentId, at: Date.now(), text });
      }}
    />
    </>
  );
}
