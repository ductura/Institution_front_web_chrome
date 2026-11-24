"use client";

// WEB-NUZ-MENTOR-1 (NF-6 MK-1): the mount point of the whole Mentor card (host/editor/mentor) in the
// "Mentor" tab of the editor's right panel, above the round's actions; on a phone the same tab is in the
// panel's drawer. Every read goes through src/client; what the server does not give stays "nedostupno".
import { useEffect, useState } from "react";

import { createApi } from "../../../../../../src/client/api.ts";
import { readConsultationSlots, type ConsultationSlot, type SlotsApi } from "../../../../../../src/client/consultation-slots.ts";
import { listRevisionRequests, type RevisionRequest } from "../../../../../../src/client/revision-requests.ts";
import { readWorkMessages, type WorkMessage } from "../../../../../../src/client/work-messages.ts";
import { readWorkMilestones, type WorkMilestone } from "../../../../../../src/client/work-milestones.ts";

import { MentorCard } from "../mentor";
import { ConsultPanel } from "../work/consult/ConsultPanel";
import { abstractWords, seenAtOf, workStateOf } from "./mentor-mount";

type Read<T> = T | null | undefined;
type Doc = Parameters<typeof abstractWords>[0];
type Reads = {
  requests: Read<readonly RevisionRequest[]>; milestones: Read<readonly WorkMilestone[]>;
  messages: Read<readonly WorkMessage[]>; slots: Read<readonly ConsultationSlot[]>;
};
/** The slots' client, made at call time (the page's origin is read then, not while rendering). */
const slotsCall = ((...args: Parameters<SlotsApi>) => createApi()(...args)) as SlotsApi;
const LOADING: Reads = { requests: undefined, milestones: undefined, messages: undefined, slots: undefined };

/** One read of everything the card shows, again when the work is submitted. Never throws. */
async function readAll(documentId: string): Promise<Reads> {
  const quiet = <T,>(p: Promise<T>) => p.catch(() => null);
  const [requests, milestones, messages, slots] = await Promise.all([
    quiet(listRevisionRequests(documentId)), quiet(readWorkMilestones(documentId)),
    quiet(readWorkMessages(documentId)), quiet(readConsultationSlots(slotsCall, documentId)),
  ]);
  return {
    requests: requests?.kind === "ok" ? requests.requests : null,
    milestones: milestones?.ok ? milestones.body.milestones : null,
    messages: messages?.ok ? messages.body.messages : null,
    slots: slots?.kind === "ready" ? slots.slots : null,
  };
}

export function MentorMount({ documentId, submitted, editor }: {
  documentId: string; submitted: boolean;
  /** The open editor; the abstract's length is counted from its text. */
  editor: { readonly state: { readonly doc: Doc }; on(event: "update", fn: () => void): unknown; off(event: "update", fn: () => void): unknown } | null;
}) {
  const [reads, setReads] = useState<Reads>(LOADING);
  const [words, setWords] = useState<number | null>(null);
  useEffect(() => {
    let live = true;
    setReads(LOADING);
    void readAll(documentId).then((next) => { if (live) setReads(next); });
    return () => { live = false; };
  }, [documentId, submitted]);
  useEffect(() => {
    if (!editor) { setWords(null); return; }
    const count = () => setWords(abstractWords(editor.state.doc));
    count();
    editor.on("update", count);
    return () => { editor.off("update", count); };
  }, [editor]);

  const state = reads.requests === undefined && !submitted ? undefined : workStateOf(submitted, reads.requests ?? null);
  return (
    <MentorCard role="student" state={state} milestones={reads.milestones} messages={reads.messages} slots={reads.slots}
      seenAt={reads.messages ? seenAtOf("student", reads.messages) : null}
      howText={null} words={words} prep={null}
      consult={<ConsultPanel documentId={documentId} role="student" revision={1} slotsCall={slotsCall} criteriaCall={null} />} />
  );
}
