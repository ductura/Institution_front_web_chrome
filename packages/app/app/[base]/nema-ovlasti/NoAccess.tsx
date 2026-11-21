"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AccessDenied } from "@ductura/ui";

import { appHref } from "../../../../../src/components/index.ts";
import { signInHref } from "../../../../../src/client/api.ts";
import { accessKindOf, holdsUnsentInput } from "../../../../../src/client/session.ts";

import { useLocale } from "../../../src/i18n";
import { internalRoute } from "../../../src/routes";
import { useHost } from "../../../src/host/context";

/** "Nema ovlasti" (403), "Potrebna je prijava" (401) and "Prijava je istekla" (session_idle_expired). */
export default function NoAccess() {
  const { base } = useHost();
  const { app: { accessDenied: text } } = useLocale();
  const params = useSearchParams();
  const kind = accessKindOf(params.get("kind"));
  const requested = params.get("returnTo");
  const back = requested === null ? null : internalRoute(requested, base);
  const [holdsInput, setHoldsInput] = useState(false);
  // Storage is the browser's, so it is read after mount; the server render never claims anything is kept.
  useEffect(() => {
    setHoldsInput(holdsUnsentInput(`${base}${back ?? "/"}`));
  }, [base, back]);
  return (
    <AccessDenied
      kind={kind}
      labels={text}
      signInHref={signInHref(appHref(base, back ?? "/"))}
      homeHref={appHref(base, "/")}
      holdsInput={holdsInput}
    />
  );
}
