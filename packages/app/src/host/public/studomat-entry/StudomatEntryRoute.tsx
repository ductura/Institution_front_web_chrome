"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";

import { leaveFor, readSession, signInHref } from "../../../../../../src/client/api.ts";
import { appHref } from "../../../../../../src/components/index.ts";
import { nextPath } from "../../../bases";
import { shellRole } from "../../../routes";
import { useHost } from "../../context";
import { studomatEntryMessages } from "./messages.hr";
import { enrollRoute, studomatTarget } from "./target";

/**
 * WEB-V22-STUDOMAT-ULAZ: the public entry from Studomat. It takes nothing from Studomat and writes nothing; it reads the
 * session once (the only server call) and redirects by `studomatTarget`. The page shows only "Preusmjeravanje".
 */
export default function StudomatEntryRoute() {
  const { base } = useHost();
  const router = useRouter();
  const query = useSearchParams();
  const search = query.toString();
  useEffect(() => {
    let live = true;
    void readSession().then((read) => {
      if (!live) return;
      // Only a signed-out read starts login; an unavailable one (no role, 5xx) goes home, where the Host shows its own screen.
      if (read.kind === "unavailable") {
        router.replace(nextPath(base, "/"));
        return;
      }
      const target = studomatTarget({
        session: read.kind === "signedIn",
        role: read.kind === "signedIn" ? shellRole(read.session.role) : null,
        query: new URLSearchParams(search),
      });
      if (target.kind === "sign-in") leaveFor(signInHref(appHref(base, target.returnTo)));
      else router.replace(nextPath(base, target.kind === "enroll" ? enrollRoute(target.courseId) : "/"));
    });
    return () => {
      live = false;
    };
  }, [base, router, search]);
  return (
    <main id="sadrzaj" tabIndex={-1}>
      <section className="page">
        <h1 role="status">{studomatEntryMessages.redirecting}</h1>
      </section>
    </main>
  );
}
