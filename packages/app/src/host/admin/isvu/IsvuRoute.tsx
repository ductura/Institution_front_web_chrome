"use client";

import { useCallback, useState } from "react";

import { appHref, homeHref } from "../../../../../../src/components/index";
import { navLabel, useLocale } from "../../../i18n";
import { useHost } from "../../context";
import { DeniedState } from "../../states/States";
import CsvImport from "./CsvImport";
import IsvuPage from "./IsvuPage";

/**
 * WEB-V22-UVOZ-EKRAN: route of the trial ISVU import. The host checks the role (administrator); the page is the route's own h1.
 * WEB-DIZ-B-V22: a 403 from the contract shows the shared "no access" state (its own h1) instead of the page.
 */
export default function IsvuRoute() {
  const { base, page, role } = useHost();
  const value = useLocale();
  const label = navLabel(page, role, value);
  const [denied, setDenied] = useState(false);
  const onDenied = useCallback(() => setDenied(true), []);
  if (denied) {
    const access = value.t.access;
    return (
      <section className="page" data-role={role ?? undefined}>
        <DeniedState title={access.deniedTitle} backLabel={access.backToOwn} backHref={appHref(base, homeHref(role))} />
      </section>
    );
  }
  return (
    <section className="page" data-role={role ?? undefined}>
      <h1>{label}</h1>
      <IsvuPage onDenied={onDenied} />
      <CsvImport onDenied={onDenied} />
    </section>
  );
}
