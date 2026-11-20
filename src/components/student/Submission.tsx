"use client";

/**
 * Step 4 of the submission (WEB-26, S: E-10, PD-3), through /api/v1 only.
 * evidence.open.post gives the work; the page shows exactly the text of its
 * revision on the server and submission.submit.post sends that revision and
 * nothing else. One request at a time: a second click while one is on its
 * way sends nothing. Success is the signed receipt (WEB-22, B-6), and only
 * then the page moves to step 5.
 *
 * TODO(ugovor): student.submission.get comes with @ductura/contracts 3.1.0
 * (SRV-19, SRV-25); until then the page passes no transport (`local`) and
 * "Provjeri stanje predaje" reads as unknown.
 * TODO(DAN-699): the device check (text on this device the server lacks)
 * returns with the editor journal of the workspace (WEB-14 part 2).
 * TODO(editor-core): `openWork` and the snapshot check of editor-core are not
 * in the pages' type graph yet, so the open is read here through createApi:
 * the body is the contract's exact shape, and the text is shown only when its
 * bytes hash to the `documentHash` the server named.
 */

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { createApi, errorBody, goToSignIn, type ApiOptions } from "@/client/api";
import { useOnline } from "@/client/online-status";
import { readSubmissionState, submitWork, type LocalCall, type SubmitInput, type SubmitOutcome } from "@/client/submission";

import { confirmationKey, readConfirmed } from "../predaja/Declaration";
import type { Stage } from "../predaja/stage";
import { SubmitDialog } from "../predaja/SubmitDialog";
import { nextOf, OUTCOME_ID, SubmissionView, type Answer, type Next, type TextNode, type WorkRead } from "./SubmissionView";

const TYPES: ReadonlySet<unknown> = new Set(["paragraph", "heading", "bulletItem", "quote"]);
const isObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

function isTextNode(node: unknown): node is TextNode {
  return isObject(node) && TYPES.has(node.type) && Array.isArray(node.children) && node.children.every((child: unknown) =>
    isObject(child) && typeof child.text === "string" && Array.isArray(child.marks) && child.marks.every((m) => typeof m === "string"));
}

/** The blocks of a snapshot, or null when its bytes do not hash to `documentHash` or it is not a document. */
export async function textOf(document: string, documentHash: string): Promise<TextNode[] | null> {
  try {
    const bytes = Uint8Array.from(atob(document), (char) => char.charCodeAt(0));
    const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
    if ([...digest].map((b) => b.toString(16).padStart(2, "0")).join("") !== documentHash) return null;
    const parsed: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    const nodes = isObject(parsed) ? parsed.nodes : undefined;
    return Array.isArray(nodes) && nodes.every(isTextNode) ? nodes : null;
  } catch {
    return null;
  }
}

/** The work to submit (evidence.open.post); a refusal that names a place is that place. */
export async function readWork(assignmentId: string, api: ApiOptions = {}): Promise<WorkRead | { kind: "notice" } | { kind: "signIn" }> {
  try {
    const result = await createApi({ ...api, protocol: "1" })("evidence.open.post", {
      params: undefined, query: undefined, body: { assignmentId },
    });
    if (!result.ok) {
      const status = (errorBody(result) as { status?: unknown } | undefined)?.status;
      if (result.status === 401) return { kind: "signIn" };
      if (status === "not_accepting") return { kind: "notice" };
      return status === "not_started" ? { kind: "empty" } : { kind: "unavailable" };
    }
    const work = result.body;
    if (work.currentRevision === 0) return { kind: "empty" };
    const nodes = await textOf(work.document, work.documentHash);
    // A text that does not hash to what the server named is never shown, so never sent.
    return nodes === null ? { kind: "unavailable" } : { kind: "ready", documentId: work.documentId, revision: work.currentRevision, nodes };
  } catch {
    return { kind: "unavailable" };
  }
}

/** Runs `send` once at a time: a call while one is on its way gets null and sends nothing. */
export function oneAtATime<A, T>(send: (input: A) => Promise<T>): (input: A) => Promise<T | null> {
  let busy = false;
  return async (input) => {
    if (busy) return null;
    busy = true;
    try {
      return await send(input);
    } finally {
      busy = false;
    }
  };
}

export type SubmissionProps = {
  readonly assignmentId: string;
  readonly stage: Stage;
  /** TODO(ugovor): the transport of student.submission.get (SRV-22); none until 3.1.0. */
  readonly local?: LocalCall;
};

/** Another assignment starts from nothing: no text or answer of the one before stays. */
export default function Submission(props: SubmissionProps) {
  return <AssignmentSubmission key={props.assignmentId} {...props} />;
}

function AssignmentSubmission({ assignmentId, stage, local }: SubmissionProps) {
  const router = useRouter();
  const online = useOnline();
  const [work, setWork] = useState<WorkRead>({ kind: "loading" });
  const [confirmed, setConfirmed] = useState(false);
  const [dialog, setDialog] = useState(false);
  const [sending, setSending] = useState(false);
  const [checking, setChecking] = useState(false);
  const [next, setNext] = useState<Extract<Next, { go: null }> | null>(null);
  const base = `/rad/${encodeURIComponent(assignmentId)}`;
  const here = `${base}/predaja/slanje`;
  const send = useRef(oneAtATime((input: SubmitInput) => submitWork(input, { local }))).current;
  // Only the last read started counts: an older answer arriving later never replaces a newer one.
  const ticket = useRef(0);

  const follow = useCallback((answer: Answer) => {
    const step = nextOf(answer);
    if (step.go === null) {
      setNext(step);
      // The answer takes the focus once it is drawn (#385 H8).
      requestAnimationFrame(() => document.getElementById(OUTCOME_ID)?.focus());
    } else if (step.go === "receipt") router.push(`${base}/predaja/potvrda`);
    else if (step.go === "notice") router.push(`/zadatak/${encodeURIComponent(assignmentId)}`);
    else goToSignIn(here);
  }, [assignmentId, base, here, router]);

  const load = useCallback(async () => {
    const mine = ++ticket.current;
    setWork({ kind: "loading" });
    setNext(null);
    const read = await readWork(assignmentId);
    if (mine !== ticket.current) return;
    if (read.kind !== "notice" && read.kind !== "signIn") setWork(read);
    else if (read.kind === "notice") router.push(`/zadatak/${encodeURIComponent(assignmentId)}`);
    else goToSignIn(here);
  }, [assignmentId, here, router]);

  // Read after the first render, so the server's markup (unconfirmed, loading) matches.
  useEffect(() => setConfirmed(readConfirmed(confirmationKey(assignmentId))), [assignmentId]);
  useEffect(() => {
    void load();
    return () => { ticket.current += 1; };
  }, [load]);

  const submit = async () => {
    if (work.kind !== "ready" || !online) return;
    setSending(true);
    const outcome: SubmitOutcome | null = await send({ assignmentId, documentId: work.documentId, revision: work.revision });
    if (outcome === null) return;
    setSending(false);
    setDialog(false);
    follow(outcome);
  };

  const check = async () => {
    if (checking) return;
    setChecking(true);
    const state = local === undefined ? { kind: "nepoznato" as const } : await readSubmissionState(local, assignmentId);
    setChecking(false);
    follow({ kind: "check", state });
  };

  return (
    <>
      <SubmissionView work={work} stage={stage} confirmed={confirmed} online={online} sending={sending} checking={checking}
        next={next} onOpen={() => setDialog(true)} onCheck={() => void check()} onReload={() => void load()}
        onDeclaration={() => router.push(`${base}/predaja/izjava`)} onBack={() => router.push(`${base}/predaja/pregled`)} />
      <SubmitDialog open={dialog} revision={work.kind === "ready" ? work.revision : 0} late={stage.kind === "closed"}
        sending={sending} onSubmit={() => void submit()} onClose={() => setDialog(false)} />
    </>
  );
}
