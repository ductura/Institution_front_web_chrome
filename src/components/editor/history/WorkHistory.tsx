/**
 * Povijest rada (E§3.3 `history`): the saved points of one work, newest
 * first. Pure: the read comes in. No text of the work and no size of change
 * is shown (PRODUCT §5 rule 7).
 */

import { messagesHr } from "../../../lib/i18n/messages.hr";
import { zagrebParts } from "../../summary/zagreb-time";
import { pointCountKey, type HistoryRead } from "./history-read";
import { workHistoryMessages as t } from "./messages.hr";

export type WorkHistoryProps = { readonly read: HistoryRead; readonly retryHref?: string };

function when(iso: string): string {
  const parts = zagrebParts(iso);
  return parts === null ? iso : `${parts.date} ${messagesHr.summary.at} ${parts.time}`;
}

export function WorkHistory({ read, retryHref }: WorkHistoryProps) {
  return (
    <section aria-labelledby="work-history-title">
      <h2 id="work-history-title">{t.title}</h2>
      <p>{t.lead}</p>
      {read.kind === "loading" && <p role="status">{t.loading}</p>}
      {read.kind === "error" && (
        <>
          <p role="alert">{t.error}</p>
          {retryHref !== undefined && <p><a href={retryHref}>{t.retry}</a></p>}
        </>
      )}
      {read.kind === "empty" && <p role="status">{t.empty}</p>}
      {read.kind === "points" && (
        <>
          <p>{t.count[pointCountKey(read.points.length)].replace("{n}", String(read.points.length))}</p>
          <ol>
            {read.points.map((point) => (
              <li key={point.id}>
                <strong>{t.reasons[point.reason]}</strong>
                {" · "}<time dateTime={point.savedAt}>{when(point.savedAt)}</time>
                {" · "}{t.revision.replace("{n}", String(point.revision))}
              </li>
            ))}
          </ol>
        </>
      )}
    </section>
  );
}
