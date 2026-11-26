"use client";

import NewCourseForm from "@/app/ustanova/kolegiji/NewCourseForm";
import { academicYears } from "@/app/ustanova/kolegiji/new-course";
import { appHref } from "@/components/index";
import { messagesHr } from "@/lib/i18n/messages.hr";

import { useHost } from "../context";
import ConfigPage from "../admin/institution-config/ConfigPage";
import RulesPage from "../admin/institution-config/RulesPage";
import { CoursesPanel, OverviewPanel, UsersPanel } from "./InstitutionPanels";
import type { messagesHr as t } from "./messages.hr";

const newCourse = messagesHr.institutionCourses.newCourse;

/** The host owns the session and role check. The three screens read the contract through ./reads (LOK-WEB-8); the course form uses the existing API client. */
export default function InstitutionPage({ view }: { view: keyof typeof t }) {
  const { base, page, role } = useHost();

  return (
    <section className="page" data-role={role ?? undefined}>
      <h1>{page.label}</h1>
      {view === "overview" && <OverviewPanel />}
      {view === "users" && <UsersPanel />}
      {view === "rules" && <RulesPage />}
      {view === "rules" && <ConfigPage />}
      {view === "courses" && <CoursesPanel />}
      {view === "courses" && (
        <section aria-labelledby="novi-kolegij">
          <h2 id="novi-kolegij">{newCourse.title}</h2>
          <p>{newCourse.lead}</p>
          <NewCourseForm here={appHref(base, page.path)} years={academicYears(new Date())} />
        </section>
      )}
    </section>
  );
}
