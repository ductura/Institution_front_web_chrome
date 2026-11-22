"use client";

import { useEffect, useState } from "react";
import { Button } from "@ductura/ui";

import { readOriginComposition, type OriginCall, type OriginRead } from "./contract";
import { originText as t } from "./messages.hr";
import { kindLabel, rhythmCell, segmentTime, shareRows, unknownLine } from "./model";

/**
 * "Podrijetlo teksta" of one work (WEB-0911; P-1; N-10): the composition by origin kind and the genealogy of
 * the segments. The component has no role prop: the student and the teacher see the same screen. Every
 * percent stands with the notice that it is not evidence of authorship; the rhythm is a column of the
 * genealogy only while the teacher has not switched it off.
 */
export default function OriginMap({ call, documentId, onSignedOut }: { call: OriginCall; documentId: string; onSignedOut?: () => void }) {
  const [read, setRead] = useState<OriginRead | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setRead(null);
    void readOriginComposition(call, documentId).then((answer) => {
      if (!active) return;
      setRead(answer);
      if (answer.kind === "signedOut") onSignedOut?.();
    });
    return () => { active = false; };
  }, [call, documentId, attempt, onSignedOut]);

  return (
    <section aria-labelledby="origin-map-h">
      <h2 id="origin-map-h">{t.title}</h2>
      <p>{t.intro}</p>
      <Body read={read} onRetry={() => setAttempt((n) => n + 1)} />
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
  const c = read.composition;
  const unknown = unknownLine(c);
  return (
    <>
      <h3>{t.compositionHeading}</h3>
      <ul>
        {shareRows(c).map((row) => <li key={row.kind} data-kind={row.kind}>{row.label}</li>)}
      </ul>
      {unknown !== null && (
        <p data-unknown-notice>
          <strong>{unknown}</strong> {t.unknownNotice}
        </p>
      )}
      <h3>{t.genealogyHeading}</h3>
      <table>
        <thead>
          <tr>
            <th scope="col">{t.colText}</th>
            <th scope="col">{t.colKind}</th>
            <th scope="col">{t.colAt}</th>
            {c.rhythmRecorded && <th scope="col">{t.colRhythm}</th>}
          </tr>
        </thead>
        <tbody>
          {c.segments.map((segment) => (
            <tr key={segment.id}>
              <td>{segment.text}</td>
              <td>{kindLabel(segment.kind)}</td>
              <td>{segmentTime(segment)}</td>
              {c.rhythmRecorded && <td>{rhythmCell(c, segment)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
      {c.rhythmRecorded && <p>{t.rhythmNotice}</p>}
    </>
  );
}
