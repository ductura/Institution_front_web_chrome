"use client";

import { useCallback, useEffect, useState } from "react";
import { Button, RouteLoading } from "@ductura/ui";

import { goToSignIn } from "@/client/api";
import { readStudentNotice, type StudentNoticeRead } from "@/client/student-notice";
import { appHref } from "@/components/shell/nav";
import AssignmentNotice from "@/components/student/AssignmentNotice";
import styles from "@/components/student/AssignmentNotice.module.css";
import { markNoticeRead } from "@/components/student/obavijest/notice-read-mark";
import { noticeWindow } from "@/components/student/notice-window";
import { messagesHr as t } from "@/lib/i18n/messages.hr";
import { useHost } from "../../context";

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

  // The shared screen renders a legacy editor link after acknowledgment.
  // Adapt it on this host, including links opened in another tab.
  const bindEditorLink = useCallback((container: HTMLDivElement | null) => {
    if (!container) return;
    const adapt = () => {
      const link = container.querySelector<HTMLAnchorElement>('a[href^="/rad?zadatak="]');
      const path = link?.getAttribute("href");
      if (link && path) link.href = appHref(base, path);
    };
    adapt();
    const observer = new MutationObserver(adapt);
    observer.observe(container, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [base]);

  return (
    <div className={`page ${styles.screen}`}>
      <p className={styles.back}>
        <a href={appHref(base, "/zadaci")}><span aria-hidden="true">← </span>{t.student.backToAssignments}</a>
      </p>
      {notice === null ? <RouteLoading label={t.student.loading} /> : notice.kind === "available" ? (
        <>
          <div
            ref={bindEditorLink}
            onClick={(event) => {
              // The shell's route interception drops query parameters. Preserve the editor's assignment.
              const link = event.target instanceof Element ? event.target.closest("a[href]") : null;
              if (link?.getAttribute("href")?.startsWith(appHref(base, "/rad?zadatak="))) event.stopPropagation();
            }}
          >
            <AssignmentNotice
              view={notice.view}
              timing={noticeWindow(notice.view.opensAt, notice.view.dueAt, Date.now())}
            />
          </div>
          {readStatus === "sending" || readStatus === "read" ? (
            <p className={styles.status} role="status">{t.student.noticeRead[readStatus]}</p>
          ) : null}
          {readStatus === "failed" || readStatus === "stale" ? (
            <div className={styles.card}>
              <p className={styles.error} role="alert">{t.student.noticeRead[readStatus]}</p>
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
