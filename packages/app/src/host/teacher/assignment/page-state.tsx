"use client";

import { Button } from "@ductura/ui";
import { useEffect, useState, type ReactNode } from "react";

import { goToSignIn } from "@/client/api";
import { appHref } from "@/components/shell/nav";
import { messagesHr } from "@/lib/i18n/messages.hr";

import { hostText } from "../../../text";
import { useHost } from "../../context";

type Read<T> = { kind: "ready"; value: T } | { kind: "signedOut" | "notTeacher" | "notFound" | "unavailable" };

export function useAssignmentRead<T>(path: string, load: () => Promise<Read<T>>) {
  const { base } = useHost();
  const [read, setRead] = useState<Read<T> | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    const unavailable: Read<T> = { kind: "unavailable" };
    void load().catch(() => unavailable).then((result) => {
      if (!active) return;
      if (result.kind === "signedOut") goToSignIn(appHref(base, path) + window.location.search);
      setRead(result);
    });
    return () => { active = false; };
    // Route parameters remount the page. Each retry starts a fresh read.
  }, [base, path, attempt]);

  return [read, () => { setRead(null); setAttempt((count) => count + 1); }] as const;
}

export function AssignmentPage<T>({ title, read, retry, unavailable, missing, children }: {
  title: string;
  read: Read<T> | null;
  retry: () => void;
  unavailable: string;
  missing?: string;
  children: (value: T, href: (path: string) => string) => ReactNode;
}) {
  const { base } = useHost();
  const href = (path: string) => appHref(base, path);
  let body: ReactNode;
  if (read === null || read.kind === "signedOut") body = <p role="status">{read === null ? hostText.loading : hostText.signingIn}</p>;
  else if (read.kind === "notTeacher") body = <p role="alert">{messagesHr.teacher.signedOut}</p>;
  else if (read.kind === "notFound") body = <p role="alert">{missing ?? unavailable}</p>;
  else if (read.kind === "unavailable") body = (
    <>
      <p role="alert">{unavailable}</p>
      <Button type="button" onClick={retry}>{messagesHr.teacherCourses.retry}</Button>
    </>
  );
  else if (read.kind === "ready") body = children(read.value, href);

  return (
    <div className="page">
      <h1>{title}</h1>
      {body}
      <p><a href={href("/nastavnik")}>{messagesHr.teacher.backCourses}</a></p>
    </div>
  );
}
