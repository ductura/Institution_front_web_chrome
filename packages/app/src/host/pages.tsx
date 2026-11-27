"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

import {
  appHref, MentoredWorks, readMentoredWorks, readTeacherCourses, TeacherCourses,
  type MentoredWorksCall, type TeacherCoursesCall,
} from "../../../../src/components/index.ts";
import { messagesHr as t } from "../../../../locales/hr.ts";
import { createApi, goToSignIn, leaveFor, readSession, signInHref } from "../../../../src/client/api.ts";

import type { Base } from "../bases";
import { internalRoute, routeOf } from "../routes";
import { hostText } from "../text";
import { useHost } from "./context";
import { AssignmentCards, NewCourseLink } from "./teacher/assignment-card/AssignmentCards";
import { CourseTasks, InterruptedPublish } from "./teacher/assignment-facts/AssignmentFacts";
import { assignmentCardMessages as card } from "./teacher/assignment-card/messages.hr";
import { teacherShellHr } from "./teacher/shell/messages.hr";
import { TeacherPage, type TeacherRead } from "./teacher/shell/TeacherPage";
import { CourseQuestionnaires } from "./teacher/questionnaire/Questionnaires";
import { CourseTeachingTeam } from "./teacher/teaching-team/TeachingTeam";
import { CourseRhythm } from "./teacher/input-rhythm/mounts";
import SignInScreen from "./signin/SignInScreen";
import { signInViewOf, skipTarget } from "./signin/sign-in-view";

// The pages the host shows, one per route of app/(host)/. Each reads the
// institution server only through src/client.

/** A page of the navigation not yet connected to the institution server: its heading and a note. */
export function PendingPage() {
  const { page, role } = useHost();
  return (
    <section className="page" data-role={role ?? undefined}>
      <h1>{page.label}</h1>
      <p>{hostText.pending}</p>
    </section>
  );
}

/** A public page not yet connected: outside the shell, so with its own main. */
export function PublicPendingPage() {
  return (
    <main id="sadrzaj" tabIndex={-1}>
      <PendingPage />
    </main>
  );
}

/**
 * Ductus /prijava (E-1, paritet 2101): the sign-in screen with the states of
 * the prototype. Sign-in is AAI@EduHr only (D-09): the button, and "Pokušaj
 * ponovno" in the error states, show "preusmjeravanje" and leave for the login
 * of the institution server. A returnTo of the app ("/zadaci" or
 * "/aplikacija/zadaci") comes back under this base; any other goes to its home.
 * `?stanje=` and the login route's `?greska=` ask for a state.
 */
export function SignInPage() {
  const { base } = useHost();
  const query = useSearchParams();
  const [leaving, setLeaving] = useState(false);
  const returnTo = query.get("returnTo");
  const route = returnTo === null ? null : internalRoute(returnTo, base);
  const href = signInHref(appHref(base, route ?? "/"));
  const start = () => {
    setLeaving(true);
    leaveFor(href);
  };
  // KA-05-WEB: a visitor who already has a session does not see the screen.
  const asked = signInViewOf(query);
  useEffect(() => {
    if (asked === "noRole" || asked === "refused") return;
    let live = true;
    void readSession().then((result) => {
      if (live && result.kind === "signedIn") leaveFor(appHref(base, skipTarget(route)));
    });
    return () => {
      live = false;
    };
  }, [base, route, asked]);
  return <SignInScreen view={leaving ? "redirecting" : asked} href={href} onStart={start} base={base} />;
}

export { TeacherPage, type TeacherRead } from "./teacher/shell/TeacherPage";

/** One read per visit and per "Pokušaj ponovno"; a signed-out answer goes to sign-in. */
export function useTeacherRead<T>(base: Base, read: () => Promise<TeacherRead<T>>): [TeacherRead<T> | null, () => void] {
  const [result, setResult] = useState<TeacherRead<T> | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let live = true;
    setResult(null);
    void read().then((value) => {
      if (!live) return;
      if (value.kind === "signedOut") goToSignIn(appHref(base, routeOf(window.location.pathname, base)));
      setResult(value);
    });
    return () => {
      live = false;
    };
    // `read` is a fresh closure each render; the attempt is what asks again.
  }, [base, attempt]);
  return [result, () => setAttempt((n) => n + 1)];
}

const coursesCall = () => createApi() as unknown as TeacherCoursesCall;
const mentorshipsCall = () => createApi() as unknown as MentoredWorksCall;

/** N-01 "Moji kolegiji" over teacher.courses.get. */
export function TeacherCoursesPage() {
  const { base } = useHost();
  const [read, retry] = useTeacherRead(base, async () => {
    const result = await readTeacherCourses(coursesCall());
    return result.kind === "ready" ? { kind: "ready", value: result.courses } : result;
  });
  return <TeacherPage title={card.title} lead={card.lead} loading={card.loading} read={read} retry={retry}
    unavailable={card.unavailable} retryLabel={card.retry} notice={<InterruptedPublish onChecked={retry} />}
    actions={(courses) => (courses.length > 0 ? <NewCourseLink /> : null)}
    ready={(courses) => <AssignmentCards courses={courses} here={appHref(base, "/nastavnik")}
      tasks={(course) => <CourseTasks course={course} />}
      extra={(course) => <><CourseRhythm courseId={course.id} name={course.name} /><CourseTeachingTeam courseId={course.id} courseName={course.name} /><CourseQuestionnaires courseId={course.id} courseName={course.name} /></>} />} />;
}

/** N-16 "Radovi uz mentora" over teacher.mentorships.get. */
export function MentoredWorksPage() {
  const { base } = useHost();
  const [read, retry] = useTeacherRead(base, async () => {
    const result = await readMentoredWorks(mentorshipsCall());
    return result.kind === "ready" ? { kind: "ready", value: result.works } : result;
  });
  const mw = t.mentoredWorks;
  return <TeacherPage title={mw.title} lead={mw.lead} loading={teacherShellHr.loadingMentorships} read={read} retry={retry} unavailable={mw.unavailable} retryLabel={mw.retry}
    ready={(works) => <MentoredWorks works={works} />} />;
}
