"use client";

import { useHost } from "../../context";
import AssistantSettingsPage from "./AssistantSettingsPage";
import FacultySettingsPage from "./FacultySettingsPage";

/** The host owns the session and role check (only the administrator reaches these routes); the page is the route's own h1. */
export default function FacultySettingsRoute({ view }: { view: "settings" | "assistant" }) {
  const { page, role } = useHost();
  return (
    <section className="page" data-role={role ?? undefined}>
      <h1>{page.label}</h1>
      {view === "settings" ? <FacultySettingsPage /> : <AssistantSettingsPage />}
    </section>
  );
}
