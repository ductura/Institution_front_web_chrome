"use client";

import { Details } from "@ductura/ui";
import { useEffect, useState } from "react";
import { browserTransport, readSession } from "../../../../client/api";
import { watchSessionEnd, type SessionWatch } from "../../../../client/session-end";
import { sessionTagOf } from "../../EditorPage.scope";
import { MentorWorkState } from "./MentorWorkState";
import { mentorWorkHr as t } from "./messages.hr";
import styles from "./MentorWorkState.module.css";

export function ReadOnlyMentor({ documentId, role, submitted, submittedAt, receiptHref }: {
  documentId?: string;
  role: "teacher" | "student";
  submitted?: boolean;
  submittedAt?: string;
  receiptHref?: string;
}) {
  const [allowed, setAllowed] = useState(false);
  const [opened, setOpened] = useState(false);
  useEffect(() => {
    let live = true;
    let watch: SessionWatch | undefined;
    let tag: string | null = null;
    const at = Date.now();
    void readSession({
      async fetchImpl(input, init) {
        const response = await browserTransport(input, init);
        if (response.status === 200) tag = sessionTagOf(await response.clone().json());
        return response;
      },
    }).then((read) => {
      if (!live || tag === null || read.kind !== "signedIn" || !read.session.roles.includes(role)) return;
      watch = watchSessionEnd({ tag, at }, () => setAllowed(false));
      if (!watch.ended()) setAllowed(true);
    });
    return () => {
      live = false;
      watch?.close();
    };
  }, [role]);

  if (!allowed) return null;
  return <Details className={role === "student" ? styles.readOnly : undefined} summary={t.mentor}
    onToggle={(event) => setOpened(event.currentTarget.open)}>
    {opened && <MentorWorkState documentId={documentId} role={role} submitted={submitted}
      submittedAt={submittedAt} receiptHref={receiptHref} />}
  </Details>;
}
