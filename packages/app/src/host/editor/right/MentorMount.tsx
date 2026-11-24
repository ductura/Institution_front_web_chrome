"use client";

// WEB-NUZ-MENTOR-1 (NF-6 MK-1): the mount point of the whole Mentor card (host/editor/mentor) in the
// "Mentor" tab of the editor's right panel, above the round's actions; on a phone the same tab is in the
// panel's drawer. Every read goes through src/client; what the server does not give stays "nedostupno".
import { useEffect, useMemo, useState } from "react";

import { createApi } from "../../../../../../src/client/api.ts";
import { readConsultationSlots, type ConsultationSlot, type SlotsApi } from "../../../../../../src/client/consultation-slots.ts";
import { listRevisionRequests, type RevisionRequest } from "../../../../../../src/client/revision-requests.ts";
import { readWorkMessages, type WorkMessage } from "../../../../../../src/client/work-messages.ts";
import { readWorkMilestones, type WorkMilestone } from "../../../../../../src/client/work-milestones.ts";

import {
  currentReturn, MentorCard, OwnPanel, PrepPanel, prepPort, SaidPanel, withReturn,
  type ReadingPlace, type ReadingPort, type ReadingWrite, type ReturnNotice, type TasksRead,
} from "../mentor";
import { placeOf, positionOf, type PlaceEditor } from "../mentor/own-place";
import { ConsultPanel } from "../work/consult/ConsultPanel";
import { docWords } from "../mentor/prep-model";
import { latestReturn } from "../mentor/round-feedback";
import { abstractWords, seenAtOf, workStateOf } from "./mentor-mount";

/** The clipboard, when the browser gives it. */
const copyText = (text: string): Promise<boolean> =>
  navigator.clipboard ? navigator.clipboard.writeText(text).then(() => true, () => false) : Promise.resolve(false);

type Read<T> = T | null | undefined;
type Doc = Parameters<typeof abstractWords>[0];
type Reads = {
  requests: Read<readonly RevisionRequest[]>; milestones: Read<readonly WorkMilestone[]>;
  messages: Read<readonly WorkMessage[]>; slots: Read<readonly ConsultationSlot[]>;
  /** WEB-NF6-RUNDA (MK-8): the whole-work returns; null when unread. */
  returns: Read<readonly ReturnNotice[]>;
  /** MK-9: the student's own "Dokle sam stao" (readingPlace of the sealed note's read). */
  reading: ReadingPlace;
};
/** The slots' client, made at call time (the page's origin is read then, not while rendering). */
const slotsCall = ((...args: Parameters<SlotsApi>) => createApi()(...args)) as SlotsApi;
const LOADING: Reads = { requests: undefined, milestones: undefined, messages: undefined, slots: undefined, returns: undefined, reading: undefined };

/** The most pages of returns read before the list counts as unread (50 returns a page). */
const RETURN_PAGES = 20;

/**
 * WEB-NF6-RUNDA (MK-8): the whole-work returns of this work. The list holds every work, newest first, so it
 * is paged (`nextBefore`) until this work's newest return is found or the list ends; a list not read to its
 * end is null ("nedostupno"), never "no return" (#631 review 2, point 4).
 */
async function readReturns(documentId: string): Promise<readonly ReturnNotice[] | null> {
  let before: string | null = null;
  for (let page = 0; page < RETURN_PAGES; page += 1) {
    const query: { before?: string } = before === null ? {} : { before };
    const answer = await createApi()("notifications.returned-for-revision.list.get", { params: undefined, query, body: undefined });
    if (!answer.ok) return null;
    const mine = answer.body.notifications.filter((n) => n.documentId === documentId);
    if (mine.length > 0) return mine;
    if (answer.body.nextBefore === null) return [];
    before = answer.body.nextBefore;
  }
  return null;
}

/** WEB-NF6-RUNDA (MK-10): the tasks agreed at consultations, for "Od dogovorenog". */
const readTasks: TasksRead = async (documentId) => {
  const answer = await createApi()("work.consultation-tasks.get", { params: { documentId }, query: undefined, body: undefined });
  return answer.ok ? answer.body.tasks : null;
};

/** WEB-NF6-RUNDA (MK-9): sets and clears "Dokle sam stao"; the state shown is the server's answer. */
function readingPort(documentId: string): ReadingPort {
  const outcome = (answer: Awaited<ReturnType<ReturnType<typeof createApi>>>): ReadingWrite => {
    if (answer.ok) {
      const body = answer.body as { readingPlace: { place: { nodeId: string; offset: number }; updatedAt: string } | null };
      return { kind: "ok", reading: { place: body.readingPlace?.place ?? null, updatedAt: body.readingPlace?.updatedAt ?? null } };
    }
    return { kind: answer.status === 401 ? "signedOut" : "failed" };
  };
  return {
    set: async (place) => outcome(await createApi()("work.reading-place.put", { params: { documentId }, query: undefined, body: { place } })),
    clear: async () => outcome(await createApi()("work.reading-place.delete", { params: { documentId }, query: undefined, body: undefined })),
  };
}

/** WEB-NF6-RUNDA (MK-9): only the reading place of the sealed note's read; the note itself stays SealedSelfNote's. */
async function readReading(documentId: string): Promise<ReadingPlace> {
  const answer = await createApi()("work.sealed-self-note.get", { params: { documentId }, query: undefined, body: undefined });
  if (answer.ok) return { place: answer.body.readingPlace?.place ?? null, updatedAt: answer.body.readingPlace?.updatedAt ?? null };
  // A missing note is `readingPlace: null` in a 200; any other answer (404 included) is "nedostupno".
  return null;
}

/** One read of everything the card shows, again when the work is submitted. Never throws. */
async function readAll(documentId: string): Promise<Reads> {
  const quiet = <T,>(p: Promise<T>) => p.catch(() => null);
  const [requests, milestones, messages, slots, returns, reading] = await Promise.all([
    quiet(listRevisionRequests(documentId)), quiet(readWorkMilestones(documentId)),
    quiet(readWorkMessages(documentId)), quiet(readConsultationSlots(slotsCall, documentId)), quiet(readReturns(documentId)),
    quiet(readReading(documentId)),
  ]);
  return {
    requests: requests?.kind === "ok" ? requests.requests : null,
    milestones: milestones?.ok ? milestones.body.milestones : null,
    messages: messages?.ok ? messages.body.messages : null,
    slots: slots?.kind === "ready" ? slots.slots : null,
    returns,
    reading,
  };
}

export function MentorMount({ documentId, submitted, editor }: {
  documentId: string; submitted: boolean;
  /** The open editor; the abstract's length is counted from its text. */
  editor: { readonly state: { readonly doc: Doc }; on(event: "update", fn: () => void): unknown; off(event: "update", fn: () => void): unknown } | null;
}) {
  const [attempt, setAttempt] = useState(0);
  const [allWords, setAllWords] = useState<number | null>(null);
  const [reads, setReads] = useState<Reads>(LOADING);
  const [words, setWords] = useState<number | null>(null);
  useEffect(() => {
    let live = true;
    setReads(LOADING);
    void readAll(documentId).then((next) => { if (live) setReads(next); });
    return () => { live = false; };
  }, [documentId, submitted, attempt]);
  useEffect(() => {
    if (!editor) { setWords(null); setAllWords(null); return; }
    const count = () => { setWords(abstractWords(editor.state.doc)); setAllWords(docWords(editor.state.doc as unknown as Parameters<typeof docWords>[0])); };
    count();
    editor.on("update", count);
    return () => { editor.off("update", count); };
  }, [editor]);

  // WEB-NF6-RUNDA (MK-8): the latest whole-work return gives the revision its deadline and the mentor's comment.
  const ret = reads.returns ? currentReturn(latestReturn(reads.returns, documentId), reads.requests ?? []) : null;
  const state = reads.requests === undefined && !submitted ? undefined : withReturn(workStateOf(submitted, reads.requests ?? null), ret);
  const said = reads.requests === undefined || reads.returns === undefined ? undefined
    : reads.requests === null || reads.returns === null ? null : { ret, requests: reads.requests };
  const prep = useMemo(() => prepPort(documentId, readTasks), [documentId]);
  const mark = useMemo(() => readingPort(documentId), [documentId]);
  const placeEditor = editor as unknown as (PlaceEditor & { commands?: { focus(pos?: number): boolean } }) | null;
  return (
    <>
      <MentorCard role="student" state={state} milestones={reads.milestones} messages={reads.messages} slots={reads.slots}
        seenAt={reads.messages ? seenAtOf("student", reads.messages) : null}
        howText={null} words={words} prep={null}
        said={<SaidPanel read={said} now={new Date()} onRetry={() => setAttempt((n) => n + 1)} />}
        prepPanel={<PrepPanel port={prep} words={allWords} editable={!submitted} onCopy={copyText} />}
        consult={<ConsultPanel documentId={documentId} role="student" revision={1} slotsCall={slotsCall} criteriaCall={null} />} />
      {/* WEB-NF6-RUNDA (MK-9): only in the student's own editor, only before submission. */}
      {!submitted && <OwnPanel documentId={documentId} reading={reads.reading} mark={mark}
        currentPlace={placeEditor ? () => placeOf(placeEditor) : undefined}
        onGoToPlace={placeEditor ? (place) => {
          const pos = positionOf(placeEditor.state.doc, place);
          if (pos !== null) placeEditor.commands?.focus(pos);
          return pos !== null;
        } : undefined} />}
    </>
  );
}
