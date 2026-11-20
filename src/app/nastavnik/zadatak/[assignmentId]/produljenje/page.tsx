import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { signInHref } from "@/client/api";
import { readDeadlineExtensions, fetchExtensionCall } from "@/client/deadline-extensions";
import { institutionServerUrl } from "@/client/server";
import { cookieTransport } from "@/client/api";
import DeadlineExtensions, { type ExtensionsRead } from "@/components/teacher/deadline-extensions/DeadlineExtensions";
import type { ExtensionStudent } from "@/components/teacher/deadline-extensions/deadline-extensions-logic";
import { messagesHr } from "@/lib/i18n/messages.hr";

const t = messagesHr.deadlineExtensions;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export const dynamic = "force-dynamic";
export const metadata = { title: `${t.title} · ${messagesHr.app.name}` };

type Props = { params: Promise<{ assignmentId: string }> };

/**
 * `/nastavnik/zadatak/{assignmentId}/produljenje` (WEB-1113, N-13): the list of
 * recorded extensions is read on the server under the request's cookie, so a
 * reload shows what was saved. A failed read is said as such, never as "none".
 *
 * TODO(ugovor): the roster of the assignment (for "jedan student") has no route
 * in the published contract; until then only "svi studenti" can be recorded.
 */
export default async function DeadlineExtensionsPage({ params }: Props) {
  const { assignmentId } = await params;
  if (!UUID.test(assignmentId)) notFound();
  const here = `/nastavnik/zadatak/${assignmentId}/produljenje`;
  const call = fetchExtensionCall(cookieTransport((await cookies()).toString()), institutionServerUrl());
  const result = await readDeadlineExtensions(call, assignmentId);
  if ("kind" in result && result.kind === "session-expired") redirect(signInHref(here));
  const read: ExtensionsRead = "kind" in result && result.kind === "ready" ? result : { kind: "unavailable" };
  const students: ExtensionStudent[] = [];
  return (
    <div className="page">
      <h1>{t.title}</h1>
      <p>{t.lead}</p>
      <DeadlineExtensions assignmentId={assignmentId} read={read} students={students} here={here} backHref="/nastavnik/kolegiji" />
    </div>
  );
}
