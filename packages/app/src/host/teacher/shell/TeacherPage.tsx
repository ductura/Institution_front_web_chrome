"use client";

// VIZ-N1: the page frame of the teacher's screens, as `head()`, `sideState()`, `loadingBody()` and
// `errorBody()` of docs/prototip/Ductura_nastavnik.html: the heading with its lead (and the actions on
// the right), then the body; loading and failure are a `.card` with the line and, on failure, the button.
// The classes are the prototype's own (packages/ui prototype.css); the shell supplies `<main id="sadrzaj">`.
import type { ReactNode } from "react";

import { messagesHr as t } from "../../../../../../locales/hr.ts";
import { hostText } from "../../../text";

/** A read of one teacher screen, as the host reads it (`useTeacherRead`). */
export type TeacherRead<T> =
  | { kind: "ready"; value: T }
  | { kind: "signedOut" }
  | { kind: "notTeacher" }
  | { kind: "unavailable" };

/** `head(title, lede, actions)` of the prototype. */
export function PageHead({ title, lead, actions }: { title: string; lead?: string; actions?: ReactNode }) {
  return (
    <div className="pagehead">
      <h1>{title}</h1>
      {actions}
      {lead ? <p className="lede">{lead}</p> : null}
    </div>
  );
}

/** The heading, its lead and one state of a teacher's read. */
export function TeacherPage<T>({ title, lead, loading = hostText.loading, read, retry, unavailable, retryLabel, ready, notice, actions }: {
  title: string; lead: string; loading?: string; read: TeacherRead<T> | null; retry: () => void;
  unavailable: string; retryLabel: string; ready: (value: T) => ReactNode;
  /** Above the body and kept across a new read (N-01 banner "prekinuto", WEB-2145). */
  notice?: ReactNode;
  /** On the right of the heading once the read is ready (N-01 "Novi kolegij i zadatak"). */
  actions?: (value: T) => ReactNode;
}) {
  if (read === null || read.kind === "signedOut") {
    return (
      <>
        <PageHead title={title} lead={lead} />
        {notice}
        <section className="card" aria-busy="true">
          <p className="note" role="status">{read === null ? loading : hostText.signingIn}</p>
          <div className="skel w80" />
          <div className="skel w60" />
          <div className="skel w40" />
        </section>
      </>
    );
  }
  if (read.kind === "notTeacher") {
    return (
      <>
        <PageHead title={title} lead={lead} />
        <section className="card"><p className="note" role="status">{t.teacher.signedOut}</p></section>
      </>
    );
  }
  if (read.kind === "unavailable") {
    return (
      <>
        <PageHead title={title} lead={lead} />
        {notice}
        <section className="card">
          <p className="note" role="alert">{unavailable}</p>
          <div className="acts"><button type="button" className="btn secondary" onClick={retry}>{retryLabel}</button></div>
        </section>
      </>
    );
  }
  return (
    <>
      <PageHead title={title} lead={lead} actions={actions?.(read.value)} />
      {notice}
      {ready(read.value)}
    </>
  );
}
