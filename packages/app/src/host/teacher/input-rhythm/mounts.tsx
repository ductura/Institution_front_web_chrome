"use client";

// PIL-P1-RITAM-NASTAVNIK: the switch mounted in the N-01 course card (for the course) and in each task of
// it (the assignment's override). The real ports over src/client; a 401 sends the browser to AAI@EduHr sign-in.
import { useCallback, useEffect, useMemo, useState } from "react";

import { createApi, goToSignIn } from "../../../../../../src/client/api";
import { assignmentRhythmPort, courseRhythmPort } from "../../../../../../src/client/input-rhythm-teacher";
import { appHref } from "../../../../../../src/components/shell/nav";
import { useHost } from "../../context";
import { RhythmSwitch } from "./RhythmSwitch";

/** The course's switch changed: the switches of its tasks that follow it read again. */
const COURSE_CHANGED = "ductura:course-rhythm-changed";

/** One sign-in for the page: every switch on it sees the same 401, the browser leaves once (N3). */
let leaving = false;

function useSignIn(): () => void {
  const { base } = useHost();
  return useCallback(() => {
    if (leaving) return;
    leaving = true;
    goToSignIn(appHref(base, "/nastavnik"));
  }, [base]);
}

export function CourseRhythm({ courseId, name }: { courseId: string; name: string }) {
  const signIn = useSignIn();
  const port = useMemo(() => courseRhythmPort(createApi(), courseId), [courseId]);
  const changed = useCallback(() => globalThis.dispatchEvent(new CustomEvent(COURSE_CHANGED, { detail: courseId })), [courseId]);
  return <RhythmSwitch level="course" port={port} name={name} onSignedOut={signIn} onChanged={changed} />;
}

export function AssignmentRhythm({ courseId, assignmentId, title }: { courseId: string; assignmentId: string; title: string }) {
  const signIn = useSignIn();
  const port = useMemo(() => assignmentRhythmPort(createApi(), assignmentId), [assignmentId]);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    const listen = (event: Event) => { if ((event as CustomEvent<string>).detail === courseId) setRefresh((n) => n + 1); };
    globalThis.addEventListener(COURSE_CHANGED, listen);
    return () => globalThis.removeEventListener(COURSE_CHANGED, listen);
  }, [courseId]);
  return <RhythmSwitch level="assignment" port={port} name={title} refresh={refresh} onSignedOut={signIn} />;
}
