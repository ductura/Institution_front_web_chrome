"use client";

import { useEffect, useState } from "react";
import { TeacherAiAttachments, type TeacherAiAttachmentsState } from "@ductura/ui";

import type { DeclarationPort, TeacherDeclarationRead } from "../../../../../../../src/client/declaration.ts";
import { teacherAiLabels } from "./messages.hr";

function toState(read: TeacherDeclarationRead): TeacherAiAttachmentsState {
  return read.kind === "unavailable" ? { kind: "error" } : read;
}

/**
 * The teacher's read-only view of a submission's AI part on the port (WEB-1209). The port hands
 * over attached conversations only, so nothing here can show one the student left out (D-41).
 */
export default function TeacherAiAttachmentsPanel({ port, submissionId }: { port: DeclarationPort; submissionId: string }) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<TeacherAiAttachmentsState>({ kind: "loading" });

  useEffect(() => {
    let active = true;
    void port.readTeacher(submissionId).then((read) => {
      if (active) setState(toState(read));
    });
    return () => { active = false; };
  }, [port, submissionId, attempt]);

  const retry = () => {
    setState({ kind: "loading" });
    setAttempt((previous) => previous + 1);
  };

  return <TeacherAiAttachments labels={teacherAiLabels} state={state} onRetry={retry} />;
}
