"use client";

import { navLabel, useLocale } from "../../../i18n";
import { useHost } from "../../context";
import IsvuPage from "./IsvuPage";

/** WEB-V22-UVOZ-EKRAN: route of the trial ISVU import. The host checks the role (administrator); the page is the route's own h1. */
export default function IsvuRoute() {
  const { page, role } = useHost();
  const label = navLabel(page, role, useLocale());
  return (
    <section className="page" data-role={role ?? undefined}>
      <h1>{label}</h1>
      <IsvuPage />
    </section>
  );
}
