"use client";

// N-18 "Izvoz za Merlin" in the host (WEB-2163): reads only through src/client (merlin-export.ts, teacher
// reads). A failed read is said as such with "Pokušaj ponovno", never shown as an empty list.
import { Button } from "@ductura/ui";
import { messagesHr as t } from "../../../../../../src/lib/i18n/messages.hr.ts";
import { hostText } from "../../../text";
import { createApi, goToSignIn, leaveFor } from "../../../../../../src/client/api.ts";
import {
  merlinCsvPath, readMerlinPackage, readMerlinRoster, requestMerlinPackage,
} from "../../../../../../src/client/merlin-export.ts";
import { readTeacherCourses, type TeacherCoursesCall } from "../../../../../../src/components/index.ts";
import { appHref } from "../../../../../../src/components/shell/nav";
import { useHost } from "../../context";
import { useTeacherRead, type TeacherRead } from "../../pages";
import Merlin from "./Merlin";
import { merlinMessages as text } from "./messages.hr";
import { merlinHref, type AssignmentChoice, type MerlinData, type MerlinPort } from "./model";

/** The port over the client: a session that ended goes to sign-in and the screen says nothing more. */
export function clientPort(returnTo: string): MerlinPort {
  const client = () => createApi();
  const guard = <T extends { kind: string }>(answer: T): T => {
    if (answer.kind === "session-expired") goToSignIn(returnTo);
    return answer;
  };
  return {
    requestPackage: async (assignmentId, key) => guard(await requestMerlinPackage(client(), assignmentId, key)),
    readPackage: async (assignmentId, packageId) => guard(await readMerlinPackage(client(), assignmentId, packageId)),
    leaveFor,
    csvPath: merlinCsvPath,
  };
}

export function MerlinExportPage({ assignmentId }: { assignmentId: string }) {
  const { base } = useHost();
  const [read, retry] = useTeacherRead<MerlinData>(base, async (): Promise<TeacherRead<MerlinData>> => {
    const [roster, courses] = await Promise.all([
      readMerlinRoster(createApi(), assignmentId),
      readTeacherCourses(createApi() as unknown as TeacherCoursesCall),
    ]);
    if (roster.kind === "session-expired") return { kind: "signedOut" };
    if (roster.kind !== "ready") return { kind: "unavailable" };
    const assignments: AssignmentChoice[] | null = courses.kind === "ready"
      ? courses.courses.flatMap((c) => c.assignments.map((a) => ({ id: a.id, title: a.title })))
      : null;
    return { kind: "ready", value: { rows: roster.rows, extensionReasons: roster.extensionReasons, assignments } };
  });
  const here = appHref(base, merlinHref(assignmentId));
  // The prototype's side page (sideState): .pagehead, then a card for loading or an error, never a bare line.
  return (
    <div className="page">
      <div className="pagehead">
        <h1>{text.title}</h1>
        <p className="lede">{text.lead}</p>
      </div>
      {read === null || read.kind === "signedOut" || read.kind === "notTeacher" ? (
        <section className="card" aria-busy={read === null ? "true" : undefined}>
          <p className="note" role="status">{read === null ? text.loading : read.kind === "signedOut" ? hostText.signingIn : t.teacher.signedOut}</p>
          {read === null && <><div className="skel w80" /><div className="skel w60" /><div className="skel w40" /></>}
        </section>
      ) : read.kind === "unavailable" ? (
        <section className="card">
          <p className="note" role="alert">{text.unavailable}</p>
          <div className="sb-acts"><Button tone="secondary" onClick={retry}>{text.retry}</Button></div>
        </section>
      ) : <Merlin assignmentId={assignmentId} data={read.value} port={clientPort(here)}
        onChoose={(id) => leaveFor(appHref(base, merlinHref(id)))} />}
    </div>
  );
}
