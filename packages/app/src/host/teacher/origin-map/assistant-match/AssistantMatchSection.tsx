"use client";

import { Button } from "@ductura/ui";

import type { OriginComposition } from "../contract";
import type { MatchRead } from "./contract";
import { matchText as t } from "./messages.hr";
import { matchRows, matchShown } from "./model";

/**
 * The matches with an answer of the assistant in "Podrijetlo teksta" (WEB-1230). Nothing is drawn while the
 * faculty flag is off. The student and the teacher see the same rows; the explanation is the student's own words.
 */
export default function AssistantMatchSection({ read, composition, onRetry }: { read: MatchRead | null; composition: OriginComposition; onRetry: () => void }) {
  if (read === null) return <p role="status">{t.loading}</p>;
  if (read.kind === "off" || read.kind === "notFound") return null;
  if (read.kind === "signedOut") return <p role="alert">{t.signedOut}</p>;
  if (read.kind === "unavailable") {
    return (
      <>
        <p role="alert">{t.unavailable}</p>
        <Button onClick={onRetry}>{t.retry}</Button>
      </>
    );
  }
  if (!matchShown(read)) return null;
  const rows = matchRows(read.state.matches, (id) => composition.segments.find((s) => s.id === id)?.text);
  return (
    <section aria-labelledby="assistant-match-h" data-assistant-match>
      <h3 id="assistant-match-h">{t.heading}</h3>
      <p>{t.intro}</p>
      <p>{t.neutral}</p>
      {rows.length === 0 ? (
        <p>{t.none}</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th scope="col">{t.colText}</th>
              <th scope="col">{t.colWords}</th>
              <th scope="col">{t.colAttached}</th>
              <th scope="col">{t.colExplanation}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.segmentId}>
                <td>{row.text}</td>
                <td>{row.words}</td>
                <td>{row.attached}</td>
                <td>{row.explanation ?? t.noExplanation}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
