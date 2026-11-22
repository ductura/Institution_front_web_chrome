"use client";

import { Button, Card } from "@ductura/ui";

import { createApi } from "../../../../../../src/client/api";
import type { MentorshipCall } from "../../../../../../src/client/mentorship-requests";
import { readMentoredWorks, type MentoredWork, type MentoredWorksCall } from "../../../../../../src/components/teacher/mentored-works-read";
import { readMentorshipRequests } from "../../../../../../src/client/mentorship-requests";
import MentoredWorks from "../../../../../../src/components/teacher/MentoredWorks";
import { MentorshipRequestsView, type RequestsRead } from "../../../../../../src/components/teacher/MentorshipRequests";
import { appHref } from "../../../../../../src/components/shell/nav";
import { messagesHr as t } from "../../../../../../locales/hr";
import { useHost } from "../../context";
import { useTeacherRead } from "../../pages";
import { teacherShellHr } from "../shell/messages.hr";
import { myStudentsText as s } from "./messages.hr";
import { studentsOf } from "./model";

const HREF = "/nastavnik/mentorstva";
const requestsCall = () => createApi() as unknown as MentorshipCall;
const worksCall = () => createApi() as unknown as MentoredWorksCall;

/**
 * N-16 (WEB-1404): the requests of students (approve or decline), "Moji studenti"
 * (the students whose request was approved) and their works. The requests read
 * through the contract client (LOK-WEB-5); a failed read says "unavailable",
 * never "none". After a decision the page reads again.
 */
export default function MentorshipsPage({ requests = requestsCall, works = worksCall }:
  { requests?: () => MentorshipCall; works?: () => MentoredWorksCall }) {
  const { base } = useHost();
  const here = appHref(base, HREF);
  const [read, retry] = useTeacherRead<{ asked: RequestsRead; works: MentoredWork[] }>(base, async () => {
    const [list, mentored] = await Promise.all([readMentorshipRequests(requests()), readMentoredWorks(works())]);
    if (mentored.kind === "signedOut") return { kind: "signedOut" };
    if (mentored.kind === "notTeacher") return { kind: "notTeacher" };
    if (mentored.kind !== "ready") return { kind: "unavailable" };
    const asked: RequestsRead = list.kind === "ready" ? { kind: "ready", requests: list.requests } : { kind: "unavailable" };
    return { kind: "ready", value: { asked, works: mentored.works } };
  });
  const mw = t.mentoredWorks;

  let body;
  if (read === null) body = <p role="status">{teacherShellHr.loadingMentorships}</p>;
  else if (read.kind === "unavailable") {
    body = (
      <>
        <p role="alert">{mw.unavailable}</p>
        <p><Button tone="quiet" onClick={retry}>{mw.retry}</Button></p>
      </>
    );
  } else if (read.kind !== "ready") body = <p role="status">{t.teacher.signedOut}</p>;
  else {
    const students = studentsOf(read.value.works);
    body = (
      <>
        <MentorshipRequestsView read={read.value.asked} here={here} call={requests()}
          onDecided={retry} />
        <Card title={s.title}>
          <p>{s.lead}</p>
          {students.length === 0 ? <p>{s.empty}</p> : (
            <ul>
              {students.map((student) => (
                <li key={student.key} data-testid="my-student">
                  <strong>{student.name ?? s.unnamed}</strong>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <MentoredWorks works={read.value.works} />
      </>
    );
  }
  return (
    <div className="page">
      <header>
        <h1>{mw.title}</h1>
        <p>{mw.lead}</p>
      </header>
      {body}
    </div>
  );
}
