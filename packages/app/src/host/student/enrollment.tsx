"use client";

// HOST-S3 (graditelj, 20. 11. 2026.): enrolment by the teacher's code in the
// host (E-5, WEB-11, F-7), read only through src/client. The screens are the
// ones of the copied pages (src/app/upis/), with the host's base on every link.
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { appHref } from "../../../../../src/components/index.ts";
import EnrolForm from "./enrol/EnrolForm";
import enrolStyles from "./enrol/Enrol.module.css";
import styles from "./enrol/EnrolledCourse.module.css";
import { courseHref, noticeHref, readCourse, type CourseRead } from "./enrol/course-read.ts";
import { createApi, leaveFor, signInHref } from "../../../../../src/client/api.ts";
import { studentHostHr as t } from "./i18n/messages.hr.ts";

import { hostText } from "../../text";
import { nextPath } from "../../bases";
import { useHost } from "../context";
import { enrolledToast } from "./toast/messages.hr";
import { useStudentToast } from "./toast/StudentToasts";

/** A navigation of a screen (written without the base) under the host's base. */
function useGo() {
  const { base } = useHost();
  const router = useRouter();
  return (href: string, replace = false) => (replace ? router.replace(nextPath(base, href)) : router.push(nextPath(base, href)));
}

/**
 * The course the student has just enrolled in (set by the form's replace-navigation, read once by the
 * step after it): the toast waits for that step because only its read knows the course's name (P-B1).
 */
let justEnrolled: string | null = null;

/** "Upis u kolegij": the code form; after enrolment the next screen is the course's notice (PRODUCT §5 rule 6). */
export function EnrollPage() {
  const { base } = useHost();
  const go = useGo();
  // PD-7: after enrolment (the form's replace-navigation to the course) the next step says so, with the name.
  const navigate = (href: string, replace = false) => {
    justEnrolled = replace && href.startsWith(courseHref("")) ? href : null;
    go(href, replace);
  };
  return (
    <div className={enrolStyles.screen}>
      <EnrolForm signInHref={signInHref(appHref(base, "/upis"))} navigate={navigate} />
    </div>
  );
}

const c = t.student.enroll.course;

/**
 * The step between the enrolment and the notice: straight to the notice of the
 * course's open assignment; this page only shows something when there is no
 * notice to go to. An unavailable read is said as such.
 */
export function EnrolledCoursePage({ courseId }: { courseId: string }) {
  const { base } = useHost();
  const go = useGo();
  const toast = useStudentToast();
  const [read, setRead] = useState<CourseRead | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let live = true;
    setRead(null);
    void readCourse(createApi(), courseId).then((value) => {
      if (live) setRead(value);
    });
    return () => {
      live = false;
    };
  }, [courseId, attempt]);
  useEffect(() => {
    // Once, and only straight after an enrolment, never on a reload or a link to this step.
    if ((read?.kind === "assignment" || read?.kind === "none") && justEnrolled === courseHref(courseId)) {
      justEnrolled = null;
      toast(enrolledToast(read.courseName));
    }
    if (read?.kind === "assignment") go(noticeHref(read.assignmentId), true);
    if (read?.kind === "signedOut") leaveFor(signInHref(appHref(base, courseHref(courseId))));
    // go and base are stable for this page; the read is what moves on.
  }, [read]);
  if (read === null || read.kind === "assignment" || read.kind === "signedOut") return <p role="status">{hostText.loading}</p>;
  return (
    <div className={`page ${styles.screen}`}>
      <section className={styles.card}>
        <h1>{t.student.enroll.title}</h1>
        <p className={styles.status} role="status">{c[read.kind]}</p>
        <div className={styles.links}>
          {read.kind === "unavailable" ? <button type="button" className="btn" onClick={() => setAttempt((n) => n + 1)}>{c.retry}</button> : null}
          <a href={appHref(base, "/upis")}>{c.another}</a>
        </div>
      </section>
    </div>
  );
}
