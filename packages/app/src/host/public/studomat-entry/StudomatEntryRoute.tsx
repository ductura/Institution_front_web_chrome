"use client";

import { navLabel, useLocale } from "../../../i18n";
import { useHost } from "../../context";

/** WEB-V22-RUTE: thin public route of the entry from Studomat; WEB-V22-STUDOMAT-ULAZ replaces the body. Reads no session and no data from Studomat. */
export default function StudomatEntryRoute() {
  const { page, role } = useHost();
  const label = navLabel(page, role, useLocale());
  return (
    <main id="sadrzaj" tabIndex={-1}>
      <section className="page">
        <h1>{label}</h1>
      </section>
    </main>
  );
}
