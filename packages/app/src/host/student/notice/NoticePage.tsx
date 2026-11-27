"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Button, RouteLoading } from "@ductura/ui";

import { goToSignIn } from "@/client/api";
import { readStudentNotice, type StudentNoticeRead } from "@/client/student-notice";
import { appHref } from "@/components/shell/nav";
import styles from "./Notice.module.css";
import { noticeWindow } from "./window";
import { studentHostHr as t } from "../i18n/messages.hr";
import { nextPath } from "../../../bases";
import { useHost } from "../../context";
import { LoadAlert } from "../../states/States";
import HostNotice from "../enrol/HostNotice";
import { editorPath } from "../enrol/model";
import NoticeSummary from "./NoticeSummary";
import { workTeamText } from "../work-team/messages.hr";
import { peerReviewText } from "../peer-review/messages.hr";

export default function NoticePage({ assignmentId }: { assignmentId: string }) {
  const { base } = useHost();
  const here = appHref(base, `/zadatak/${encodeURIComponent(assignmentId)}`);
  const [attempt, setAttempt] = useState(0);
  const router = useRouter();
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

  const view = notice?.kind === "available" ? notice.view : null;
  const timing = view ? noticeWindow(view.opensAt, view.dueAt, Date.now()) : null;
  const viewId = view?.assignmentId;
  // R-19: a fresh confirmation goes straight to the work (E-7).
  const openWork = useCallback(() => {
    if (viewId) router.push(nextPath(base, editorPath(viewId)));
  }, [router, base, viewId]);

  return (
    <div className={`page ${styles.screen}`}>
      <p className={styles.back}>
        <a href={appHref(base, "/zadaci")}><span aria-hidden="true">← </span>{t.student.backToAssignments}</a>
      </p>
      {notice === null ? <RouteLoading label={t.student.loading} /> : notice.kind === "available" ? (
        <>
          {/* E-6 `nijeotvoren`: only the card, no summary and no ways into the work. */}
          {timing === "notOpen" ? null : (
            <>
              <NoticeSummary view={notice.view} />
              {/* WEB-V19-GRUPA: the way into the student's team on this assignment. */}
              <p><a href={appHref(base, `/zadatak/${encodeURIComponent(assignmentId)}/tim`)} data-testid="work-team-link">{workTeamText.title}</a></p>
              {/* WEB-V19-RECENZIJA-STUDENT: the way into the anonymous peer review of this assignment. */}
              <p><a href={appHref(base, `/zadatak/${encodeURIComponent(assignmentId)}/recenzija`)} data-testid="peer-review-link">{peerReviewText.title}</a></p>
            </>
          )}
          <HostNotice
            view={notice.view}
            timing={timing ?? "open"}
            editorHref={appHref(base, editorPath(notice.view.assignmentId))}
            backHref={appHref(base, "/zadaci")}
            onReload={retry}
            onOpenWork={openWork}
          />
        </>
      ) : notice.kind === "signedOut" ? (
        // G4: a 401 goes straight to AAI@EduHr and back (returnTo), as on /rad; no sign-in card.
        <RouteLoading label={t.student.loading} />
      ) : (
        <section className={styles.card} aria-labelledby="zadatak">
          <h1 id="zadatak">{t.student.title}</h1>
          {notice.kind === "unavailable" ? (
            // G2: the shared role=alert frame in the error colour; the button below stays, so no extra link.
            <>
              <LoadAlert body={t.student.unavailable} />
              <Button onClick={retry}>{t.auth.retry}</Button>
            </>
          ) : (
            <p className={styles.status} role="status">{t.student[notice.kind]}</p>
          )}
          {notice.kind === "notFound" ? <a className="btn" href={appHref(base, "/upis")}>{t.student.enroll.title}</a> : null}
        </section>
      )}
    </div>
  );
}
