"use client";

import { useEffect, useState } from "react";
import { DeclarationAi, type DeclarationAiState, type DeclarationAttachment } from "@ductura/ui";

import type { DeclarationPort, StudentDeclarationRead } from "../../../../../../src/client/declaration.ts";
import { declarationLabels, declarationStatus } from "./messages.hr";

type Status = "idle" | "confirming" | "confirmed" | "stale" | "failed";

function toState(read: StudentDeclarationRead): DeclarationAiState {
  switch (read.kind) {
    case "unavailable":
      return { kind: "error" };
    case "no_use":
    case "ai_disabled":
      return { kind: read.kind };
    case "ready":
      return { kind: "ready", uses: read.uses, conversations: read.conversations };
  }
}

/**
 * The AI part of the student's declaration on the port (WEB-1209). Required conversations stay
 * attached; a confirmation the server calls stale reloads the current versions, which asks for a
 * new review of exactly those versions before the student can confirm again.
 */
export default function StudentDeclaration({ port, submissionId }: { port: DeclarationPort; submissionId: string }) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<DeclarationAiState>({ kind: "loading" });
  const [status, setStatus] = useState<Status>("idle");

  useEffect(() => {
    let active = true;
    void port.readStudent(submissionId).then((read) => {
      if (active) setState(toState(read));
    });
    return () => { active = false; };
  }, [port, submissionId, attempt]);

  const confirm = async (attachments: DeclarationAttachment[]) => {
    setStatus("confirming");
    const result = await port.confirm(submissionId, attachments);
    if (result.kind === "stale") {
      setState(toState(await port.readStudent(submissionId)));
      setStatus("stale");
      return;
    }
    setStatus(result.kind === "confirmed" ? "confirmed" : "failed");
  };

  const retry = () => {
    setState({ kind: "loading" });
    setAttempt((previous) => previous + 1);
  };

  return (
    <div data-declaration-status={status}>
      {status === "confirmed"
        ? <p role="status">{declarationStatus.confirmed}</p>
        : <DeclarationAi labels={declarationLabels} state={state} onConfirm={(a) => void confirm(a)} onRetry={retry} />}
      {status === "confirming" && <p role="status">{declarationStatus.confirming}</p>}
      {status === "stale" && <p role="alert">{declarationStatus.stale}</p>}
      {status === "failed" && <p role="alert">{declarationStatus.failed}</p>}
    </div>
  );
}
