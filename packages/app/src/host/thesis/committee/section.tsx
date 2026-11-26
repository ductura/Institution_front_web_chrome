"use client";

// WEB-V16-POVJERENSTVO: the section "Povjerenstvo" of the "Završni rad" panel. The student and the mentor read the
// members' names and roles and nothing else; there is no control here and no view of the work for the committee.
import { createApi, goToSignIn } from "@/client/api";
import { Notice } from "@ductura/ui";

import type { SectionRead, SectionViewProps, ThesisSectionDef } from "../model";
import { committeeHr as t } from "./messages.hr";
import { readCommittee, type CommitteeMember, type CommitteeValue } from "./read";

export const nameOf = (m: CommitteeMember): string => (m.name === null ? t.unnamed : `${m.name.givenName} ${m.name.familyName}`);

/** Chair first, then the members in the server's order. */
export const ordered = (members: readonly CommitteeMember[]): readonly CommitteeMember[] =>
  [...members.filter((m) => m.role === "chair"), ...members.filter((m) => m.role !== "chair")];

export async function readSection(documentId: string, call: ReturnType<typeof createApi> = createApi()): Promise<SectionRead<CommitteeValue>> {
  // A signed-out answer sends the person to sign-in, like the other sections; it is never shown as "nema podataka".
  const watched = (async (...args: Parameters<typeof call>) => {
    const r = await call(...args);
    if (!r.ok && (r.status === 401 || r.code === "unauthorized" || r.code === "session_expired")) goToSignIn(window.location.pathname);
    return r;
  }) as typeof call;
  return readCommittee(watched, documentId);
}

export function CommitteeSection({ value }: SectionViewProps<CommitteeValue>) {
  return (
    <div>
      {value.members.length === 0 ? <p>{t.none}</p> : (
        <ul aria-label={t.listLabel}>
          {ordered(value.members).map((m) => (
            <li key={m.userId} data-role={m.role}>{nameOf(m)} ({t.roles[m.role]})</li>
          ))}
        </ul>
      )}
      {value.changedByPart !== null ? <p>{t.changedBy[value.changedByPart]}</p> : null}
      <Notice>{t.noAccessNote}</Notice>
    </div>
  );
}

export const section: ThesisSectionDef<CommitteeValue> = {
  id: "committee",
  order: 100,
  title: t.title,
  read: (documentId) => readSection(documentId),
  View: (props) => <CommitteeSection {...props} />,
};
