"use client";

// PIL-P1-PODUDARANJE-EDITOR (P-1 rule 13): the student's notice of an assistant match, mounted in
// the student's own writing (/rad, the full editor) over the real route. The server stores no
// finding while the faculty switch is off, so the notice then shows nothing. It has no route for
// the explanation yet, so the notice asks for none.
import { useMemo } from "react";

import { createAssistantMatchCall, type MatchCall } from "@/client/assistant-match";

import AssistantMatchNotice from "./AssistantMatchNotice";

export function AssistantMatchNoticeHost({ documentId, call }: { documentId: string; call?: MatchCall }) {
  const port = useMemo(() => call ?? createAssistantMatchCall(), [call]);
  return <AssistantMatchNotice call={port} documentId={documentId} explainable={false} />;
}
