"use client";

import { useCallback, useState } from "react";

import { WorkMessages } from "../messages/WorkMessages";
import { StagesCard } from "./StagesCard";
import { stagesHr as t } from "./stages-messages.hr";
import type { MentorAccess } from "./useMentorRead";

type Props = Omit<MentorAccess, "onSessionEnd"> & {
  role: "student" | "teacher";
  mayEditDue?: boolean;
};

export function WorkMentorSections(props: Props) {
  return <WorkMentorContent key={props.documentId} {...props} />;
}

function WorkMentorContent({ documentId, role, current, mayEditDue = false }: Props) {
  const [ended, setEnded] = useState(false);
  const onSessionEnd = useCallback(() => setEnded(true), []);
  if (ended) return <p role="alert">{t.signedOut}</p>;

  const access = { documentId, current, onSessionEnd };
  return <>
    <StagesCard {...access} mentor={role === "teacher" && mayEditDue} />
    <WorkMessages {...access} role={role} />
  </>;
}
