"use client";

// F4-EDI-R14: /rad/<assignmentId>/nastavnik, the student's own work as the teacher's layout lists it. Read only,
// from student.assignments.get and student.assignment-work.get; no new server route. Anyone else's or an unknown
// assignment is not found.
import { notFound, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { appHref } from "../../../../../../../src/components/index.ts";
import { assignmentIdOf, editorWorkRead, type EditorWorkRead } from "../../../../../../../src/components/editor/EditorPage.read.ts";
import { createApi, goToSignIn } from "../../../../../../../src/client/api.ts";
import { withMentoredAssignments } from "../../../../../../../src/components/student/mentored-assignments.ts";
import { messagesHr as shared } from "../../../../../../../src/lib/i18n/messages.hr.ts";

import { nextPath } from "../../../../bases";
import { useHost } from "../../../context";
import { DeniedState } from "../../../states/States";
import { momentHr } from "../frame";
import { teacherViewText as t } from "./messages.hr";
import { rowsOf } from "./model";

const NONE = { params: undefined, query: undefined, body: undefined } as const;
const UNREACHED = { ok: false, status: 0 } as const;

export default function TeacherViewPage({ assignmentId: raw }: { assignmentId: string }) {
  const { base } = useHost();
  const router = useRouter();
  const id = assignmentIdOf(raw);
  const [read, setRead] = useState<EditorWorkRead | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (id === null) return;
    let live = true;
    setRead(null);
    void (async () => {
      const client = withMentoredAssignments(createApi());
      const [assignments, work] = await Promise.all([
        client("student.assignments.get", NONE).catch(() => UNREACHED),
        client("student.assignment-work.get", NONE).catch(() => UNREACHED),
      ]);
      if (live) setRead(editorWorkRead(id, assignments as never, work as never, { refusals: true }));
    })();
    return () => { live = false; };
  }, [id, attempt]);

  if (id === null || read?.kind === "notFound") notFound();
  const here = appHref(base, `/rad/${id}/nastavnik`);
  if (read?.kind === "signedOut") { goToSignIn(here); return null; }
  if (read?.kind === "noticeFirst") { router.replace(nextPath(base, `/zadatak/${id}`)); return null; }
  // Design alignment 27. 11. 2026. (A3): a 403 is not a read error; the heading and the way back to one's own space.
  if (read?.kind === "denied") {
    return <div className="page"><DeniedState title={shared.access.deniedTitle} backLabel={shared.access.backToOwn} backHref={appHref(base, "/")} /></div>;
  }
  const back = <p><a href={appHref(base, `/rad/${id}`)}>{t.back}</a></p>;
  const rows = read === null ? null : rowsOf(read);
  let body;
  if (read === null) body = <p role="status">{t.loading}</p>;
  else if (rows === null) body = <><p role="alert">{t.unavailable}</p><button type="button" onClick={() => setAttempt((n) => n + 1)}>{t.retry}</button></>;
  else body = (
    <>
      <p>{t.lead}</p>
      <section aria-labelledby="tv-facts">
        <h2 id="tv-facts">{t.facts}</h2>
        <dl>
          <dt>{t.task}</dt><dd>{rows.title}</dd>
          <dt>{t.course}</dt><dd>{rows.course}</dd>
          <dt>{t.due}</dt><dd>{momentHr(rows.dueAt) ?? "—"}</dd>
          <dt>{t.state}</dt><dd>{t.states[rows.workState]}</dd>
        </dl>
      </section>
      <section aria-labelledby="tv-seen">
        <h2 id="tv-seen">{t.seen}</h2>
        <p>{t.seenLead}</p>
        <ul>
          <li><a href={appHref(base, `/rad/${id}/podrijetlo`)}>{t.origin}</a></li>
          <li><a href={appHref(base, `/rad/${id}/reprodukcija`)}>{t.replay}</a></li>
        </ul>
      </section>
    </>
  );
  return <div className="page"><h1>{t.title}</h1>{back}{body}</div>;
}
