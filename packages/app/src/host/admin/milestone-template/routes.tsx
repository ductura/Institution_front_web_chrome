"use client";

import { useHost } from "../../context";
import MilestoneTemplatePage from "./MilestoneTemplatePage";

/** The host owns the session and role check (only the administrator reaches the route); the page is the route's own h1. */
export default function MilestoneTemplateRoute() {
  const { page, role } = useHost();
  return (
    <section className="page" data-role={role ?? undefined}>
      <h1>{page.label}</h1>
      <MilestoneTemplatePage />
    </section>
  );
}
