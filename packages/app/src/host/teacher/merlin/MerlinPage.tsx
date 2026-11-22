"use client";

// N-18 "Izvoz za Merlin" in the host (WEB-2163): reads only through src/client (merlin-export.ts, teacher
// reads). A failed read is said as such with "Pokušaj ponovno", never shown as an empty list.
import { createApi, goToSignIn, leaveFor } from "../../../../../../src/client/api.ts";
import {
  merlinCsvPath, readMerlinPackage, readMerlinRoster, requestMerlinPackage,
} from "../../../../../../src/client/merlin-export.ts";
import { readTeacherCourses, type TeacherCoursesCall } from "../../../../../../src/components/index.ts";
import { appHref } from "../../../../../../src/components/shell/nav";
import { useHost } from "../../context";
import { TeacherPage, useTeacherRead, type TeacherRead } from "../../pages";
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
  return (
    <TeacherPage title={text.title} lead={text.lead} loading={text.loading} read={read} retry={retry}
      unavailable={text.unavailable} retryLabel={text.retry}
      ready={(data) => <Merlin assignmentId={assignmentId} data={data} port={clientPort(here)}
        onChoose={(id) => leaveFor(appHref(base, merlinHref(id)))} />} />
  );
}
