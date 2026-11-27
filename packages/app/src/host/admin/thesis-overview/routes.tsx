"use client";

import { useHost } from "../../context";
import ThesisOverviewPage from "./ThesisOverviewPage";

/** The host owns the session and role check (only the administrator reaches the route); the page draws the route's h1 itself, so a 403 shows its own heading and not two. */
export default function ThesisOverviewRoute() {
  const { page, role } = useHost();
  return (
    <section className="page" data-role={role ?? undefined}>
      <ThesisOverviewPage title={page.label} />
    </section>
  );
}
