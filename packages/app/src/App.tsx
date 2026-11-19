import { RouteLoading } from "@ductura/ui";
import { useCallback, useEffect, useState, type ReactNode } from "react";

import {
  AppShell, appHref, MentoredWorks, readMentoredWorks, readTeacherCourses, StudentHome, TeacherCourses,
  type MentoredWorksCall, type MyAssignmentsRead, type ShellRole, type TeacherCoursesCall,
} from "../../../src/components/index.ts";
import ErrorScreen from "../../../src/components/shell/ErrorScreen.ts";
import { readMyAssignments, type AssignmentsCall } from "../../../src/components/student/my-assignments-read.ts";
import { messagesHr as t } from "../../../locales/hr.ts";
import { createApi, goToSignIn, leaveFor, readSession, signInHref, signOut, type SessionRead } from "../../../src/client/api.ts";

import { crumbsOf, internalRoute, resolve, routeOf, shellRole, type Base, type Page } from "./routes";
import styles from "./SignOut.module.css";
import { hostText } from "./text";

/** The browser's path of an app route under the base. */
function here(base: Base, route: string): string {
  return appHref(base, route);
}

/**
 * The institution front (#2028 c.6993786629 §3.3): reads the session once,
 * sends a signed-out browser to AAI@EduHr sign-in (D-09), and shows the page
 * of the path for the session's role inside the shell, with the institution's
 * name. Links of the app open without a reload.
 */
export default function App({ base }: { base: Base }) {
  const [session, setSession] = useState<SessionRead | null>(null);
  const [route, setRoute] = useState(() => routeOf(window.location.pathname, base));

  const load = useCallback(() => {
    setSession(null);
    void readSession().then((read) => {
      if (read.kind === "signedOut") goToSignIn(here(base, routeOf(window.location.pathname, base)));
      setSession(read);
    });
  }, [base]);
  useEffect(load, [load]);

  const navigate = useCallback((to: string, replace = false) => {
    const path = here(base, to);
    if (replace) window.history.replaceState(null, "", path);
    else window.history.pushState(null, "", path);
    setRoute(to);
    if (!replace) window.scrollTo(0, 0);
  }, [base]);

  useEffect(() => {
    const onPop = () => setRoute(routeOf(window.location.pathname, base));
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (anchor === null || anchor.hasAttribute("download") || (anchor.getAttribute("target") ?? "_self") !== "_self") return;
      const to = internalRoute(anchor.getAttribute("href") ?? "", base);
      if (to === null) return;
      event.preventDefault();
      navigate(to);
    };
    window.addEventListener("popstate", onPop);
    document.addEventListener("click", onClick);
    return () => {
      window.removeEventListener("popstate", onPop);
      document.removeEventListener("click", onClick);
    };
  }, [base, navigate]);

  const signedIn = session?.kind === "signedIn" ? session.session : null;
  const role = signedIn === null ? null : shellRole(signedIn.role);
  const resolved = signedIn === null ? null : resolve(route, role);

  useEffect(() => {
    if (resolved?.kind === "redirect") navigate(resolved.to, true);
  }, [resolved, navigate]);

  useEffect(() => {
    const page = resolved?.kind === "page" ? resolved.page.label : null;
    document.title = page === null ? t.app.name : `${page} · ${t.app.name}`;
  }, [resolved]);

  if (session === null) return <RouteLoading label={hostText.loading} />;
  if (session.kind === "signedOut") return <RouteLoading label={hostText.signingIn} />;
  if (session.kind === "unavailable") {
    return <ErrorScreen title={hostText.sessionUnavailableTitle} body={hostText.sessionUnavailable} onRetry={load} />;
  }
  if (resolved === null || resolved.kind === "redirect") return <RouteLoading label={hostText.loading} />;

  const shell = (current: string | undefined, crumbs: readonly string[], children: ReactNode, ownMain = false) => (
    <AppShell
      role={role}
      scope={null}
      current={current}
      crumbs={crumbs}
      base={base}
      institution={signedIn?.institution ?? null}
      account={<SignOut />}
      ownMain={ownMain}
    >
      {children}
    </AppShell>
  );

  if (resolved.kind === "notFound") {
    return shell(undefined, [t.errorPage.notFoundTitle], <ErrorScreen title={t.errorPage.notFoundTitle} body={t.errorPage.notFoundBody} />, true);
  }
  if (resolved.kind === "noRole") {
    return shell(undefined, [], <section className="page"><h1>{t.home.welcome}</h1><p>{hostText.noRole}</p></section>);
  }
  const { page } = resolved;
  return shell(page.path, crumbsOf(page, role), <PageBody page={page} base={base} role={role} />);
}

function PageBody({ page, base, role }: { page: Page; base: Base; role: ShellRole | null }) {
  if (page.kind === "studentHome" || page.kind === "studentCourses") {
    return <StudentPage base={base} view={page.kind === "studentHome" ? "home" : "courses"} />;
  }
  if (page.kind === "teacherCourses") return <TeacherCoursesPage base={base} />;
  if (page.kind === "mentoredWorks") return <MentoredWorksPage base={base} />;
  return (
    <section className="page" data-role={role ?? undefined}>
      <h1>{page.label}</h1>
      <p>{hostText.pending}</p>
    </section>
  );
}

/** S01 and S02 over student.assignments.get, read once per visit. */
function StudentPage({ base, view }: { base: Base; view: "home" | "courses" }) {
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
  return <StudentHome read={read} enroll={null} view={view} signIn={(returnTo) => signInHref(here(base, returnTo))} />;
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
      if (value.kind === "signedOut") goToSignIn(here(base, routeOf(window.location.pathname, base)));
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
function TeacherCoursesPage({ base }: { base: Base }) {
  const [read, retry] = useTeacherRead(base, async () => {
    const result = await readTeacherCourses(coursesCall());
    return result.kind === "ready" ? { kind: "ready", value: result.courses } : result;
  });
  const tc = t.teacherCourses;
  return <TeacherPage title={tc.title} lead={tc.lead} read={read} retry={retry} unavailable={tc.unavailable} retryLabel={tc.retry}
    ready={(courses) => <TeacherCourses courses={courses} />} />;
}

/** N-16 "Radovi uz mentora" over teacher.mentorships.get. */
function MentoredWorksPage({ base }: { base: Base }) {
  const [read, retry] = useTeacherRead(base, async () => {
    const result = await readMentoredWorks(mentorshipsCall());
    return result.kind === "ready" ? { kind: "ready", value: result.works } : result;
  });
  const mw = t.mentoredWorks;
  return <TeacherPage title={mw.title} lead={mw.lead} read={read} retry={retry} unavailable={mw.unavailable} retryLabel={mw.retry}
    ready={(works) => <MentoredWorks works={works} />} />;
}

/** "Odjava": auth.logout.post, then the preloader. */
function SignOut() {
  const [state, setState] = useState<"idle" | "busy" | "failed">("idle");
  const onClick = async () => {
    setState("busy");
    if (await signOut()) leaveFor("/");
    else setState("failed");
  };
  return (
    <>
      <button type="button" className={styles.signOut} onClick={() => void onClick()} disabled={state === "busy"}>
        {state === "busy" ? t.auth.loggingOut : t.shell.signOut}
      </button>
      {state === "failed" ? <p role="alert" className={styles.failed}>{hostText.signOutFailed}</p> : null}
    </>
  );
}
