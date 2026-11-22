"use client";

import { ActionRow, Notice } from "@ductura/ui";
import { useContext } from "react";

import { appHref } from "../../../../../../src/components/shell/nav";
import { HostContext } from "../../context";

import { publishHr } from "./messages.hr";

/** What the teacher sees after a confirmed publish: the confirmation and a link back to the courses (no automatic jump). */
export function PublishDone() {
  const host = useContext(HostContext);
  return (
    <Notice>
      <p>{publishHr.published}</p>
      {host && <ActionRow><a className="btn secondary" href={appHref(host.base, "/nastavnik/kolegiji")}>{publishHr.toCourses}</a></ActionRow>}
    </Notice>
  );
}

/** Link shown under the wizard while a publish is of unknown outcome: the teacher checks the list first. */
export function CheckListLink({ courseId, title }: { courseId?: string; title?: string } = {}) {
  const host = useContext(HostContext);
  if (!host) return null;
  // The course list shows the banner "prekinuto" for this assignment (WEB-2145).
  const query = new URLSearchParams({ objava: "prekinuta", ...(courseId ? { kolegij: courseId } : {}), ...(title ? { zadatak: title } : {}) });
  return (
    <Notice tone="warn">
      <p><b>{publishHr.uncertainTitle}</b> {publishHr.uncertainBody}</p>
      <ActionRow><a className="btn secondary" href={appHref(host.base, `/nastavnik/kolegiji?${query.toString()}`)}>{publishHr.checkList}</a></ActionRow>
    </Notice>
  );
}
