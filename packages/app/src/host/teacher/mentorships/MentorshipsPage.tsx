"use client";

import { createApi } from "../../../../../../src/client/api";
import type { MentorshipCall } from "../../../../../../src/client/mentorship-requests";
import { readMentoredWorks, type MentoredWork, type MentoredWorksCall } from "../../../../../../src/components/teacher/mentored-works-read";
import { readMentorshipRequests } from "../../../../../../src/client/mentorship-requests";
import { type RequestsRead } from "../../../../../../src/components/teacher/MentorshipRequests";
import { appHref } from "../../../../../../src/components/shell/nav";
import { messagesHr as t } from "../../../../../../locales/hr";
import { useHost } from "../../context";
import { useTeacherRead } from "../../pages";
import { teacherShellHr } from "../shell/messages.hr";
import { RequestsCard } from "../n16/RequestsCard";
import { WorksList } from "../n16/WorksList";
import { TeacherPage } from "../shell/TeacherPage";

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
  return (
    <TeacherPage title={mw.title} lead={mw.lead} loading={teacherShellHr.loadingMentorships} read={read} retry={retry}
      unavailable={mw.unavailable} retryLabel={mw.retry}
      ready={(value) => (
        <>
          <WorksList works={value.works} base={base} />
          <RequestsCard read={value.asked} here={here} call={requests()} onDecided={retry} />
        </>
      )} />
  );
}
