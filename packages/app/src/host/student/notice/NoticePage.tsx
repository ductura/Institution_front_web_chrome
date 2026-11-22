"use client";

import { useEffect, useState } from "react";
import { Button, RouteLoading } from "@ductura/ui";

import { goToSignIn } from "@/client/api";
import { readStudentNotice, type StudentNoticeRead } from "@/client/student-notice";
import { appHref } from "@/components/shell/nav";
import styles from "@/components/student/AssignmentNotice.module.css";
import { markNoticeRead } from "@/components/student/obavijest/notice-read-mark";
import { noticeWindow } from "@/components/student/notice-window";
import { messagesHr as t } from "@/lib/i18n/messages.hr";
import { useHost } from "../../context";
import HostNotice from "../enrol/HostNotice";
import { editorPath } from "../enrol/model";
import { noticeReadText } from "./messages.hr";

type ReadStatus = "idle" | "sending" | "read" | "stale" | "failed";

export default function NoticePage({ assignmentId }: { assignmentId: string }) {
  const { base } = useHost();
  const here = appHref(base, `/zadatak/${encodeURIComponent(assignmentId)}`);
  const [attempt, setAttempt] = useState(0);
  const [notice, setNotice] = useState<StudentNoticeRead | null>(null);
  const [readStatus, setReadStatus] = useState<ReadStatus>("idle");

  useEffect(() => {
    let active = true;
    void readStudentNotice(assignmentId).then(async (loaded) => {
      if (!active) return;
      setNotice(loaded);
      if (loaded.kind === "signedOut") {
        goToSignIn(here);
        return;
      }
      if (loaded.kind !== "available" || loaded.readAt !== null) return;

      setReadStatus("sending");
      const mark = await markNoticeRead(loaded.view.assignmentId, loaded.view.versionNo);
      if (!active) return;
      if (mark.kind === "signedOut") {
        goToSignIn(here);
        return;
      }
      setReadStatus(mark.kind === "read" || mark.kind === "stale" ? mark.kind : "failed");
    });
    return () => { active = false; };
  }, [assignmentId, attempt, here]);

  const retry = () => {
    setNotice(null);
    setReadStatus("idle");
    setAttempt((previous) => previous + 1);
  };

  return (
    <div className={`page ${styles.screen}`}>
      <p className={styles.back}>
        <a href={appHref(base, "/zadaci")}><span aria-hidden="true">← </span>{t.student.backToAssignments}</a>
      </p>
      {notice === null ? <RouteLoading label={t.student.loading} /> : notice.kind === "available" ? (
        <>
          <HostNotice
            view={notice.view}
            timing={noticeWindow(notice.view.opensAt, notice.view.dueAt, Date.now())}
            editorHref={appHref(base, editorPath(notice.view.assignmentId))}
          />
          {readStatus === "sending" || readStatus === "read" ? (
            <p className={styles.status} role="status">{noticeReadText[readStatus]}</p>
          ) : null}
          {readStatus === "failed" || readStatus === "stale" ? (
            <div className={styles.card}>
              <p className={styles.error} role="alert">{noticeReadText[readStatus]}</p>
              <Button onClick={retry}>{t.auth.retry}</Button>
            </div>
          ) : null}
        </>
      ) : (
        <section className={styles.card} aria-labelledby="zadatak">
          <h1 id="zadatak">{t.student.title}</h1>
          <p className={styles.status} role="status">{t.student[notice.kind]}</p>
          {notice.kind === "unavailable" ? <Button onClick={retry}>{t.auth.retry}</Button> : null}
          {notice.kind === "notFound" ? <a className="btn" href={appHref(base, "/upis")}>{t.student.enroll.title}</a> : null}
        </section>
      )}
    </div>
  );
}
