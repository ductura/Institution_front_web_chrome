"use client";

import { Notice } from "@ductura/ui";

import { noticeLines, type NoticeFields } from "./notice-preview";
import { noticeAckHr, noticePreviewHr as text } from "./messages.hr";

/** NZ-7a: what the student will read. Reading only; the form below stays the one place that changes anything. */
export function NoticePreview({ fields }: { fields: NoticeFields }) {
  return (
    <section aria-labelledby="np-h">
      <h2 id="np-h">{text.title}</h2>
      <p className="note">{text.lead}</p>
      <dl>
        {noticeLines(fields).map((l) => (
          <div key={l.label}><dt>{l.label}</dt><dd>{l.value}</dd></div>
        ))}
      </dl>
    </section>
  );
}

/** NZ-8: the honest state while the server gives no confirmation per student. */
export function NoticeAckUnavailable() {
  return (
    <Notice tone="warn">
      <p><b>{noticeAckHr.title}</b> {noticeAckHr.unavailable}</p>
    </Notice>
  );
}
