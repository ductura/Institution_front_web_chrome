"use client";

import { createApi } from "../../../../../../src/client/api";
import type { MentorshipCall } from "../../../../../../src/client/mentorship-requests";
import { readMentoredWorks, type MentoredWork, type MentoredWorksCall } from "../../../../../../src/components/teacher/mentored-works-read";
import { readMentorshipRequests } from "../../../../../../src/client/mentorship-requests";
import { type RequestsRead } from "../../../../../../src/components/teacher/MentorshipRequests";
import { appHref } from "../../../../../../src/components/shell/nav";
import { messagesHr as t } from "../../../../../../locales/hr";
import { Fragment, useMemo } from "react";
import { useHost } from "../../context";
import { useTeacherRead } from "../../pages";
import { teacherShellHr } from "../shell/messages.hr";
import { RequestsCard } from "../n16/RequestsCard";
import { WorksList } from "../n16/WorksList";
import { TeacherPage } from "../shell/TeacherPage";
import KeyDates from "../key-dates/KeyDates";
import { keyDatesPort, type KeyDatesCall } from "../key-dates/contract";
import { keyDatesMessages } from "../key-dates/messages.hr";
import { goToSignIn } from "../../../../../../src/client/api";
import { studentName } from "../../../../../../src/components/teacher/mentored-works-view";
import { mentorshipsOf, roundWorks, startedWorks } from "./model";
import { RoundReview } from "./RoundReview";
import { MyStudents } from "./MyStudents";
import type { OverviewCall } from "./overview-read";
import { OpenMentorshipCard } from "./OpenMentorshipCard";
import { ThesisPanel } from "../../thesis/ThesisPanel";
import { WorkPlan } from "./WorkPlan";
import { MentorNotes } from "./MentorNotes";
import type { NotesCall } from "./notes-port";
import { mentorJournalText } from "../practice-journal/messages.hr";
import type { PlanCall } from "./plan-actions";
import type { RecordsRead } from "./AgreedCard";

const HREF = "/nastavnik/mentorstva";
const requestsCall = () => createApi() as unknown as MentorshipCall;
const worksCall = () => createApi() as unknown as MentoredWorksCall;
const keyDatesCall = () => createApi() as unknown as KeyDatesCall;
const overviewCall = () => createApi() as unknown as OverviewCall;
const notesCall = () => createApi() as unknown as NotesCall;

/**
 * N-16 (WEB-1404): the requests of students (approve or decline), "Moji studenti"
 * (the students whose request was approved) and their works. The requests read
 * through the contract client (LOK-WEB-5); a failed read says "unavailable",
 * never "none". After a decision the page reads again. PIL-K-ROKOVI: each mentorship has its
 * key-dates card (mentorship.key-dates.get), read on its own; its failure never hides the page.
 * WEB-NF6-ETAPE (MK-5, MK-6, MK-7): "Novo mentorstvo" (not available yet), and per started work its stages,
 * plan writes and what was agreed at the latest consultation, each read on its own.
 * WEB-NF6-PREGLED (MK-11): "Moji studenti" under the works list, what waits on the mentor first.
 */
export default function MentorshipsPage({ requests = requestsCall, works = worksCall, keyDates = keyDatesCall, overview = overviewCall, plan, records, notes = notesCall }:
  { requests?: () => MentorshipCall; works?: () => MentoredWorksCall; keyDates?: () => KeyDatesCall; overview?: () => OverviewCall;
    plan?: () => PlanCall; records?: RecordsRead; notes?: () => NotesCall }) {
  const { base } = useHost();
  const datesPort = useMemo(() => keyDatesPort(keyDates), [keyDates]);
  const here = appHref(base, HREF);
  const signedOut = () => goToSignIn(here);
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
          <MyStudents works={value.works} call={overview} base={base} />
          {/* WEB-V19-DNEVNIK-MENTOR: the way into the practice journals of the mentored students. */}
          <p><a href={appHref(base, "/nastavnik/mentorstva/dnevnik-prakse")} data-testid="practice-journal-link">{mentorJournalText.linkFromMentorships}</a></p>
          {/* WEB-NF6-RUNDA (MK-8): "Pregled runde" of each started work. */}
          {roundWorks(value.works).map((w) => (
            <RoundReview key={w.documentId} work={{ documentId: w.documentId, name: w.name, href: appHref(base, w.path) }} />
          ))}
          {mentorshipsOf(value.works).map((m) => (
            <KeyDates key={m.mentorshipId} mentorshipId={m.mentorshipId} port={datesPort} title={keyDatesMessages.forStudent(m.name)} />
          ))}
          {/* MEN-R14 (MEN-38): the mentor's private working notes, one card per mentorship. */}
          {mentorshipsOf(value.works).map((m) => (
            <MentorNotes key={m.mentorshipId} mentorshipId={m.mentorshipId} name={m.name} call={notes} onSignedOut={signedOut} />
          ))}
          <RequestsCard read={value.asked} here={here} call={requests()} onDecided={retry} />
          <OpenMentorshipCard />
          {startedWorks(value.works).map((work) => (
            <Fragment key={work.documentId}>
              <WorkPlan documentId={work.documentId} name={studentName(work)} title={work.title} base={base}
                onSignedOut={signedOut} plan={plan} records={records} />
              {/* WEB-V16-KOSTUR: the shared "Završni rad" panel of this mentored work. */}
              <ThesisPanel documentId={work.documentId} role="mentor" />
            </Fragment>
          ))}
        </>
      )} />
  );
}
