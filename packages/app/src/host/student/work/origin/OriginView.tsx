"use client";

import { Button } from "@ductura/ui";

import { originText as t } from "../../../teacher/provenance/origin-messages.hr";
import { shareRows, unknownLine } from "../../../teacher/provenance/origin-model";
import type { OriginRead } from "../../../teacher/provenance/origin";

/**
 * The composition by origin kind with the captions of the teacher's screen (WEB-0911): same labels, same order,
 * "Nepoznato podrijetlo nije prekršaj…" and "Ductura ne otkriva alate izvan sebe…". The student sees only their own
 * work; the page has no role prop and no figure that is not in the answer.
 */
export function OriginView({ read, onRetry }: { read: OriginRead | null; onRetry: () => void }) {
  return (
    <section aria-labelledby="origin-student-h">
      <h2 id="origin-student-h">{t.title}</h2>
      <p>{t.intro}</p>
      <Body read={read} onRetry={onRetry} />
      <p>{t.limits}</p>
    </section>
  );
}

function Body({ read, onRetry }: { read: OriginRead | null; onRetry: () => void }) {
  if (read === null) return <p role="status">{t.loading}</p>;
  if (read.kind === "empty") return <p role="status">{t.empty}</p>;
  if (read.kind === "notFound") return <p role="alert">{t.notFound}</p>;
  if (read.kind === "signedOut") return <p role="alert">{t.signedOut}</p>;
  if (read.kind === "unavailable") {
    return (
      <>
        <p role="alert">{t.unavailable}</p>
        <Button onClick={onRetry}>{t.retry}</Button>
      </>
    );
  }
  const unknown = unknownLine(read.composition);
  return (
    <>
      <h3>{t.compositionHeading}</h3>
      <ul>
        {shareRows(read.composition).map((row) => <li key={row.kind} data-kind={row.kind}>{row.label}</li>)}
      </ul>
      {unknown !== null && (
        <p data-unknown-notice>
          <strong>{unknown}</strong> {t.unknownNotice}
        </p>
      )}
    </>
  );
}
