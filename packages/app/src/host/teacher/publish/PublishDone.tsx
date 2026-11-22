"use client";

import { useContext } from "react";

import { appHref } from "../../../../../../src/components/shell/nav";
import { HostContext } from "../../context";

import { publishHr } from "./messages.hr";

/** What the teacher sees after a confirmed publish: the confirmation and a link back to the courses (no automatic jump). */
export function PublishDone() {
  const host = useContext(HostContext);
  return (
    <>
      <p>{publishHr.published}</p>
      {host && <p><a href={appHref(host.base, "/nastavnik/kolegiji")}>{publishHr.toCourses}</a></p>}
    </>
  );
}

/** Link shown under the wizard while a publish is of unknown outcome: the teacher checks the list first. */
export function CheckListLink() {
  const host = useContext(HostContext);
  if (!host) return null;
  return <p><a href={appHref(host.base, "/nastavnik/kolegiji")}>{publishHr.checkList}</a></p>;
}
