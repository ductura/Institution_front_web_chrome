"use client";

import { useEffect, useState } from "react";
import { Button, RouteLoading } from "@ductura/ui";

import { goToSignIn } from "@/client/api";
import { readStudentNotice, type StudentNoticeRead } from "@/client/student-notice";
import { appHref } from "@/components/shell/nav";
import styles from "./Notice.module.css";
import { noticeWindow } from "./window";
import { studentHostHr as t } from "../i18n/messages.hr";
import { useHost } from "../../context";
import HostNotice from "../enrol/HostNotice";
import { editorPath } from "../enrol/model";
import NoticeSummary from "./NoticeSummary";

export default function NoticePage({ assignmentId }: { assignmentId: string }) {
  const { base } = useHost();
  const here = appHref(base, `/zadatak/${encodeURIComponent(assignmentId)}`);
  const [attempt, setAttempt] = useState(0);
  const [notice, setNotice] = useState<StudentNoticeRead | null>(null);

  useEffect(() => {
    let active = true;
    void readStudentNotice(assignmentId).then((loaded) => {
      // P-9 (a): opening the notice sends nothing; only the acknowledgment is written.
      if (!active) return;
      setNotice(loaded);
      if (loaded.kind === "signedOut") goToSignIn(here);
    });
    return () => { active = false; };
  }, [assignmentId, attempt, here]);

  const retry = () => {
    setNotice(null);
    setAttempt((previous) => previous + 1);
  };

  return (
    <div className={`page ${styles.screen}`}>
      <p className={styles.back}>
        <a href={appHref(base, "/zadaci")}><span aria-hidden="true">← </span>{t.student.backToAssignments}</a>
      </p>
      {notice === null ? <RouteLoading label={t.student.loading} /> : notice.kind === "available" ? (
        <>
          <NoticeSummary view={notice.view} />
          <HostNotice
            view={notice.view}
            timing={noticeWindow(notice.view.opensAt, notice.view.dueAt, Date.now())}
            editorHref={appHref(base, editorPath(notice.view.assignmentId))}
          />
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
