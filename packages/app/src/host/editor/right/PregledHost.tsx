"use client";

// WEB-2127: the group "Pregled" with the checks the institution enabled for this
// assignment (one read of the text-check config; none read = every check of this build).
import { useEffect, useState } from "react";

import { fetchTextCheckConfig } from "../../../../../../src/client/text-check-config.ts";
import { PregledGroup } from "./PregledGroup";

type Props = Parameters<typeof PregledGroup>[0];

export function PregledHost({ editor, assignmentId, documentId }: Pick<Props, "editor" | "documentId"> & { assignmentId: string }) {
  const [ids, setIds] = useState<readonly string[] | null>(null);
  useEffect(() => {
    let live = true;
    void fetchTextCheckConfig(assignmentId).then((outcome) => {
      if (live) setIds(outcome.kind === "ok" ? outcome.config.enabledCheckIds : null);
    }).catch(() => { if (live) setIds(null); });
    return () => { live = false; };
  }, [assignmentId]);
  return <PregledGroup editor={editor} documentId={documentId} enabledCheckIds={ids} />;
}
