"use client";

import { useCallback, useState } from "react";

import { WorkMessages } from "../messages/WorkMessages";
import { StagesCard } from "./StagesCard";
import { stagesHr as t } from "./stages-messages.hr";
import type { MentorAccess } from "./useMentorRead";

type Props = Omit<MentorAccess, "onSessionEnd"> & {
  /** The shell's way to the AAI@EduHr sign-in; without it the section says the session ended. */
  onSessionEnd?: () => void;
  role: "student" | "teacher";
  mayEditDue?: boolean;
};

export function WorkMentorSections(props: Props) {
  return <WorkMentorContent key={props.documentId} {...props} />;
}

function WorkMentorContent({ documentId, role, current, mayEditDue = false, onSessionEnd: leave }: Props) {
  const [ended, setEnded] = useState(false);
  const onSessionEnd = useCallback(() => { setEnded(true); leave?.(); }, [leave]);
  if (ended) return leave ? null : <p role="alert">{t.signedOut}</p>;

  const access = { documentId, current, onSessionEnd };
  return <>
    <StagesCard {...access} mentor={role === "teacher" && mayEditDue} />
    <WorkMessages {...access} role={role} />
  </>;
}
