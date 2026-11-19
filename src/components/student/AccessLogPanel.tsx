"use client";

import { useEffect, useState } from "react";

import { createApi, signInHref } from "@/client/api";
import { messagesHr as t } from "@/lib/i18n/messages.hr";

import { type AccessLogCursor, type AccessLogRead, pageHref, readAccessLog } from "./access-log-read";
import { AccessLogDays, AccessLogUnavailable } from "./AccessLogView";

const a = t.accessLog;

/**
 * WEB-13 (S-42): reads one page of the student's own access log in the
 * browser (access-log-read.ts) and shows it. Opening this page never starts a
 * work. Older pages and a retry are plain links read again from the address.
 */
export default function AccessLogPanel({ assignmentId, cursor, here }: { assignmentId: string; cursor: AccessLogCursor | null; here: string }) {
  const [read, setRead] = useState<AccessLogRead | null>(null);

  useEffect(() => {
    let live = true;
    readAccessLog(createApi({ protocol: "1" }), createApi(), assignmentId, cursor).then(
      (result) => live && setRead(result),
      () => live && setRead({ kind: "unavailable" }),
    );
    return () => {
      live = false;
    };
  }, [assignmentId, cursor?.beforeAt, cursor?.beforeId]);

  // Inside the shell's <main>: a status line, not RouteLoading (which brings its own main).
  if (read === null) return <p role="status" aria-busy="true">{a.loading}</p>;
  switch (read.kind) {
    case "ok":
      return (
        <>
          {/* The note explains the log, so it stands only above a log that was read. */}
          <p className="access-log__note">{a.note}</p>
          <AccessLogDays days={read.days} olderHref={read.next === null ? null : pageHref(here, read.next)} newestHref={read.continued ? here : null} />
        </>
      );
    case "unavailable":
      return <AccessLogUnavailable retryHref={pageHref(here, cursor)} />;
    case "signedOut":
      return (
        <>
          <p role="status">{a.signInFirst}</p>
          {/* The login route answers with a redirect: a plain link, never a prefetched one. */}
          <p><a className="btn" href={signInHref(here)}>{a.signIn}</a></p>
        </>
      );
    case "notStarted":
      return <p role="status">{a.notStarted}</p>;
    default:
      return <p role="status">{a.notFound}</p>;
  }
}
