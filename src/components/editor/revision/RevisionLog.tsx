import { formatDateTimeHr } from "@/lib/i18n/hr";

import { sendRevisionHr as t } from "./messages.hr";
import type { LogEntry } from "./revision-log";

/** The "Dnevnik dorade" list; every text is React text, never HTML. */
export default function RevisionLog({ entries }: { entries: readonly LogEntry[] }) {
  return (
    <section aria-label={t.log.title}>
      <h3>{t.log.title}</h3>
      {entries.length === 0 ? <p>{t.log.empty}</p> : (
        <ol>
          {entries.map((e) => (
            <li key={e.key}>
              <strong>{t.log[e.by]}</strong>{": "}{t.log[e.kind].replace("{n}", String(e.round))}{", "}
              <time dateTime={e.at}>{formatDateTimeHr(e.at)}</time>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
