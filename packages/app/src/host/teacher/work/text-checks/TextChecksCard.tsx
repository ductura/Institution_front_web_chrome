// ED-130: the text checks in the teacher's view of a work. "U komentar" opens a new comment on the
// words of the finding with its first line filled in; the teacher publishes it from Komentari.
import { CheckActionList } from "@ductura/ui";
import { useId, useMemo, useState } from "react";

import { reviewMessagesHr as review } from "@/components/editor/review/messages.hr";
import { detailOf } from "@/components/editor/review/view";
import type { LiveTextDocument } from "@/components/teacher/comment-place";
import type { TextAnchor } from "@/domain/collaboration";

import { textChecksHr as t } from "./messages.hr";
import { commentableFindings, commentTextOf, findingAnchor } from "./model";

export const ACTION_TO_COMMENT = "to-comment";

export default function TextChecksCard({ document, ready, onComment }: {
  document: LiveTextDocument;
  /** False while the comments cannot take a new one (still loading, or not available). */
  ready: boolean;
  onComment: (anchor: TextAnchor, text: string) => void;
}) {
  const findings = useMemo(() => commentableFindings(document, null), [document]);
  const [status, setStatus] = useState("");
  const titleId = useId();
  const rows = findings.map((finding) => ({
    id: finding.id,
    severity: finding.severity,
    title: review.kind[finding.kind],
    detail: `${finding.excerpt} — ${detailOf(finding)}`,
    actions: [{ id: ACTION_TO_COMMENT, label: t.toComment }],
  }));
  return (
    <section aria-labelledby={titleId}>
      <h2 id={titleId}>{t.title}</h2>
      <p>{t.note}</p>
      <CheckActionList findings={rows} labels={{ list: t.list, empty: t.empty, required: t.required, advisory: t.advisory }}
        onAction={({ findingId, actionId }) => {
          if (actionId !== ACTION_TO_COMMENT) return;
          const finding = findings.find((f) => f.id === findingId);
          const text = finding ? commentTextOf(finding.kind) : null;
          if (!finding || text === null) return;
          if (!ready) return setStatus(t.waiting);
          const anchor = findingAnchor(document, finding);
          if (!anchor) return setStatus(t.noAnchor);
          onComment(anchor, text);
          setStatus(t.done);
        }} />
      <p role="status">{status}</p>
    </section>
  );
}
