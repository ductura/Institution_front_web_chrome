"use client";

import { noticeLines, type NoticeFields } from "./notice-preview";
import { noticePreviewHr as text } from "./messages.hr";

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

