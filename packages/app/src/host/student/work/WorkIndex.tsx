"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@ductura/ui";

import { appHref } from "../../../../../../src/components/index.ts";
import { createApi, goToSignIn } from "../../../../../../src/client/api.ts";
import { hostText } from "../../../text";
import { nextPath } from "../../../bases";
import { useHost } from "../../context";
import { workText as t } from "./messages.hr";
import { indexRead, type IndexRead } from "./model";

const NONE = { params: undefined, query: undefined, body: undefined } as const;
const UNREACHED = { ok: false, status: 0 } as const;

/**
 * "/rad" (nav "Radni prostor", E-7; WEB-2105) instead of the pending page:
 * it opens the editor of the one work in progress (or the work the notice's
 * link names), lists several, or says there is none. Reads only through src/client.
 */
export function WorkIndex() {
  const { base } = useHost();
  const router = useRouter();
  const zadatak = useSearchParams().get("zadatak");
  const [read, setRead] = useState<IndexRead | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let live = true;
    setRead(null);
    void (async () => {
      const client = createApi();
      const [assignments, work] = await Promise.all([
        client("student.assignments.get", NONE).catch(() => UNREACHED),
        client("student.assignment-work.get", NONE).catch(() => UNREACHED),
      ]);
      if (!live) return;
      const next = indexRead(assignments as never, work as never, zadatak);
      if (next.kind === "signedOut") return goToSignIn(appHref(base, "/rad"));
      if (next.kind === "go") return router.replace(nextPath(base, `/rad/${next.assignmentId}`));
      setRead(next);
    })();
    return () => { live = false; };
  }, [base, zadatak, attempt]);

  if (read === null) return <p role="status">{hostText.loading}</p>;
  return (
    <section className="page">
      <h1>{t.indexTitle}</h1>
      {read.kind === "unavailable" && (
        <>
          <p role="alert">{t.unavailable}</p>
          <Button onClick={() => setAttempt((n) => n + 1)}>{t.retry}</Button>
        </>
      )}
      {read.kind === "empty" && (
        <>
          <p>{t.none}</p>
          <a href={appHref(base, "/zadaci")}>{t.toTasks}</a>
        </>
      )}
      {read.kind === "list" && (
        <>
          <p>{t.indexIntro}</p>
          <ul aria-label={t.inProgress}>
            {read.items.map((item) => (
              <li key={item.id}>
                <strong>{item.title}</strong> · {item.course}{" "}
                <a href={appHref(base, `/rad/${item.id}`)} aria-label={t.openFor.replace("{title}", item.title)}>{t.open}</a>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
