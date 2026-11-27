"use client";

// F4-NAS-R12 (NAS-30): the assignment's title and kind of work on N-06, N-07, N-09, N-10 and N-11, from the same
// teacher.courses.get read as "Pregled rada" (readContext). teacher.work.get gives the student and the assignment, not
// its title, so the title comes from the teacher's own course list. When that list does not name the assignment,
// the line keeps the plain kind "Rad" and no title is guessed (B-6). Nothing here throws or writes.
import { useEffect, useState } from "react";

import { createApi, type ApiOptions } from "@/client/api";

import { readContext } from "../work/review/read";
import { WORK_TYPES, type Context } from "../work/review/model";
import { workFrameMessages as text } from "./messages.hr";

/** "Student A · Seminarski rad „Naslov”", or "Student A · Rad" without the assignment (the N-06 heading so far). */
export function taskHeading(studentName: string | null, context: Context | null): string {
  const student = studentName ?? text.noName;
  return context === null ? `${student} · ${text.workKind}` : `${student} · ${WORK_TYPES[context.workType]} „${context.title}”`;
}

export type WorkContext = { readonly studentName: string | null; readonly context: Context | null };

/** teacher.work.get for the student and the assignment, then readContext; null when the work itself cannot be read. */
export async function readWorkContext(documentId: string, options?: ApiOptions): Promise<WorkContext | null> {
  try {
    const work = await createApi(options)("teacher.work.get", { params: { documentId }, query: undefined, body: undefined });
    if (!work.ok || work.body.documentId !== documentId) return null;
    return { studentName: work.body.studentName, context: await readContext(work.body.assignmentId, options) };
  } catch {
    return null;
  }
}

/** The assignment around a work the page already knows, by its id; null until read, when not listed or on failure. */
export function useTaskContext(assignmentId: string | null, read: (id: string) => Promise<Context | null> = readContext): Context | null {
  const [context, setContext] = useState<Context | null>(null);
  useEffect(() => {
    setContext(null);
    if (assignmentId === null) return;
    let live = true;
    void read(assignmentId).then((next) => { if (live) setContext(next); });
    return () => { live = false; };
  }, [assignmentId, read]);
  return context;
}

/**
 * The crumb line of the work's sub-pages (N-07, N-09, N-10, N-11): undefined while it is read or when the work cannot
 * be read, so the page keeps its own fallback and never shows an invented title.
 */
export function useTaskCrumb(documentId: string, read: (id: string) => Promise<WorkContext | null> = readWorkContext): string | undefined {
  const [crumb, setCrumb] = useState<string | undefined>(undefined);
  useEffect(() => {
    setCrumb(undefined);
    let live = true;
    void read(documentId).then((next) => { if (live && next !== null) setCrumb(taskHeading(next.studentName, next.context)); });
    return () => { live = false; };
  }, [documentId, read]);
  return crumb;
}
