"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

import {
  appHref, MentoredWorks, readMentoredWorks, readTeacherCourses, RouteLoading, StudentHome, TeacherCourses,
  type MentoredWorksCall, type MyAssignmentsRead, type TeacherCoursesCall,
} from "../../../../src/components/index.ts";
import { readMyAssignments, type AssignmentsCall } from "../../../../src/components/student/my-assignments-read.ts";
import { messagesHr as t } from "../../../../locales/hr.ts";
import { createApi, goToSignIn, leaveFor, signInHref } from "../../../../src/client/api.ts";

import type { Base } from "../bases";
import { internalRoute, routeOf } from "../routes";
import { hostText } from "../text";
import { useHost } from "./context";

// The pages the host shows, one per route of app/[base]/. Each reads the
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
 * Ductus /prijava: sign-in is AAI@EduHr only (D-09), so the page goes straight
 * to the login of the institution server. A returnTo of the app ("/zadaci" or
 * "/app/web/zadaci") comes back under this base; any other goes to its home.
 */
export function SignInPage() {
  const { base } = useHost();
  const returnTo = useSearchParams().get("returnTo");
  useEffect(() => {
    const route = returnTo === null ? null : internalRoute(returnTo, base);
    leaveFor(signInHref(appHref(base, route ?? "/")));
  }, [base, returnTo]);
  return <RouteLoading label={hostText.signingIn} />;
}

/** S01 and S02 over student.assignments.get, read once per visit. */
export function StudentPage({ view }: { view: "home" | "courses" }) {
  const { base } = useHost();
  const [read, setRead] = useState<MyAssignmentsRead | null>(null);
  useEffect(() => {
    let live = true;
    void readMyAssignments(createApi() as unknown as AssignmentsCall).then((result) => {
      if (live) setRead(result);
    });
    return () => {
      live = false;
    };
  }, []);
  if (read === null) return <p role="status">{hostText.loading}</p>;
  return <StudentHome read={read} enroll={null} view={view} signIn={(returnTo) => signInHref(appHref(base, returnTo))} />;
}

type TeacherRead<T> = { kind: "ready"; value: T } | { kind: "signedOut" } | { kind: "notTeacher" } | { kind: "unavailable" };

/** One read per visit and per "Pokušaj ponovno"; a signed-out answer goes to sign-in. */
function useTeacherRead<T>(base: Base, read: () => Promise<TeacherRead<T>>): [TeacherRead<T> | null, () => void] {
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

/** The page heading, its lead and one state of a teacher's read. */
function TeacherPage<T>({ title, lead, read, retry, unavailable, retryLabel, ready }: {
  title: string; lead: string; read: TeacherRead<T> | null; retry: () => void;
  unavailable: string; retryLabel: string; ready: (value: T) => ReactNode;
}) {
  let body: ReactNode;
  if (read === null || read.kind === "signedOut") body = <p role="status">{read === null ? hostText.loading : hostText.signingIn}</p>;
  else if (read.kind === "notTeacher") body = <p role="status">{t.teacher.signedOut}</p>;
  else if (read.kind === "unavailable") {
    body = (
      <>
        <p role="alert">{unavailable}</p>
        <p><button type="button" className="btn" onClick={retry}>{retryLabel}</button></p>
      </>
    );
  } else body = ready(read.value);
  return (
    <div className="page">
      <header>
        <h1>{title}</h1>
        <p>{lead}</p>
      </header>
      {body}
    </div>
  );
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
  const tc = t.teacherCourses;
  return <TeacherPage title={tc.title} lead={tc.lead} read={read} retry={retry} unavailable={tc.unavailable} retryLabel={tc.retry}
    ready={(courses) => <TeacherCourses courses={courses} />} />;
}

/** N-16 "Radovi uz mentora" over teacher.mentorships.get. */
export function MentoredWorksPage() {
  const { base } = useHost();
  const [read, retry] = useTeacherRead(base, async () => {
    const result = await readMentoredWorks(mentorshipsCall());
    return result.kind === "ready" ? { kind: "ready", value: result.works } : result;
  });
  const mw = t.mentoredWorks;
  return <TeacherPage title={mw.title} lead={mw.lead} read={read} retry={retry} unavailable={mw.unavailable} retryLabel={mw.retry}
    ready={(works) => <MentoredWorks works={works} />} />;
}
