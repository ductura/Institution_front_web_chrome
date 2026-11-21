import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";

import { signInHref } from "@/client/api";
import { serverApi } from "@/client/server";
import AppHeader from "@/components/shell/AppHeader";
import ThemeRestore from "@/components/shell/ThemeRestore";
import { messagesHr } from "@/lib/i18n/messages.hr";

import { academicYears } from "./new-course";
import NewCourseForm from "./NewCourseForm";
import styles from "./page.module.css";

const t = messagesHr.institutionCourses;
const HREF = "/ustanova/kolegiji";
const NONE = { params: undefined, query: undefined, body: undefined } as const;

// The session cookie is read per request.
export const dynamic = "force-dynamic";

type Screen = "signedOut" | "notFound" | "allowed" | "unavailable";

// One session read per request, shared by the title and the page.
const resolveScreen = cache(async (): Promise<Screen> => {
  const cookie = (await headers()).get("cookie") ?? "";
  const me = await serverApi(cookie)("profile.me.get", NONE).catch(() => ({ ok: false, status: 0 }) as const);
  if (me.ok) return me.body.roles.includes("institution_admin") ? "allowed" : "notFound";
  if (me.status === 401) return "signedOut";
  return me.status === 403 ? "notFound" : "unavailable";
});

// No static title (DAN-313): the browser would apply it after a 404 and name the page in the tab.
export async function generateMetadata(): Promise<Metadata> {
  const title = (await resolveScreen()) === "notFound" ? messagesHr.errorPage.notFoundTitle : t.newCourse.title;
  return { title: `${title} · ${messagesHr.app.name}` };
}

/**
 * `/ustanova/kolegiji` (WEB-20, A-03): the institution administrator creates a
 * course with its holder and seminar groups. The session is read through
 * src/client only (profile.me.get) with the request's cookie. Signed out →
 * AAI@EduHr sign-in, back here; anyone but an administrator → the 404 of a
 * route that does not exist, as A-03 had it. The list of courses waits for a
 * read in the contract (Ductus#2028 c.7018068277).
 */
export default async function InstitutionCoursesPage() {
  const screen = await resolveScreen();
  if (screen === "signedOut") redirect(signInHref(HREF));
  if (screen === "notFound") notFound();
  return (
    <>
      <ThemeRestore />
      <AppHeader />
      <main id="sadrzaj" tabIndex={-1} className="page">
        <header className={styles.heading}>
          <h1>{t.newCourse.title}</h1>
          <p className={styles.lead}>{t.newCourse.lead}</p>
        </header>
        {screen === "allowed"
          ? <NewCourseForm here={HREF} years={academicYears(new Date())} />
          : <p role="alert" className={styles.alert}>{t.unavailable}</p>}
      </main>
    </>
  );
}
