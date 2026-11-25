"use client";

import { navLabel, useLocale } from "../../../i18n";
import { useHost } from "../../context";

/** WEB-V22-RUTE: thin route of the trial ISVU import; WEB-V22-UVOZ-EKRAN replaces the body. The host checks the role (administrator). */
export default function IsvuRoute() {
  const { page, role } = useHost();
  const label = navLabel(page, role, useLocale());
  return (
    <section className="page" data-role={role ?? undefined}>
      <h1>{label}</h1>
    </section>
  );
}
