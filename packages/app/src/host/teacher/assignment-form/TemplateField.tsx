"use client";

import { Checkbox, FormSection as Section } from "@ductura/ui";
import { useEffect, useState } from "react";

import type { createApi } from "@/client/api";

import { templateFieldHr as t } from "./messages.hr";

type Call = ReturnType<typeof createApi>;

/** "none": the switch is off, nothing was sent. "conflict": the server refused the change (409). */
export type TemplateOutcome = "saved" | "none" | "conflict" | "signedOut" | "failed";

/** The outline of the faculty template for a kind of work, as `institution.work-template.get` returns it. */
export type Outline = {
  version: number;
  titlePage: readonly ("title" | "author" | "mentor" | "course" | "date")[];
  sections: readonly { title: string; hint: string }[];
};
/** "none": the faculty has no template for this kind; "unavailable": not readable now (also for a teacher without access). */
export type OutlineRead = { kind: "loading" } | { kind: "ready"; outline: Outline } | { kind: "none" } | { kind: "unavailable" };
export type LoadOutline = (workType: string) => Promise<OutlineRead>;

const WORK_TYPES = ["short_paper", "essay", "seminar_paper", "bachelor_thesis", "master_thesis", "specialist_thesis", "doctoral_thesis"] as const;
type WorkTypeId = (typeof WORK_TYPES)[number];

/** institution.work-template.get through the shared client; any refusal or unexpected answer is "unavailable", never "none". */
export async function readOutline(call: Call, workType: string): Promise<OutlineRead> {
  if (!(WORK_TYPES as readonly string[]).includes(workType)) return { kind: "unavailable" };
  try {
    const result = await call("institution.work-template.get", { params: { workType: workType as WorkTypeId }, query: {}, body: undefined });
    if (!result.ok) return { kind: "unavailable" };
    const current = result.body.current;
    return current === null ? { kind: "none" } : { kind: "ready", outline: { version: current.version, titlePage: current.titlePage, sections: current.sections } };
  } catch {
    return { kind: "unavailable" };
  }
}

/**
 * teacher.assignment-template.put for a freshly created assignment. Sent only when the switch is on; saved only when the
 * answer repeats the choice that was sent.
 */
export async function saveTemplate(call: Call, assignmentId: string, useInstitutionTemplate: boolean): Promise<TemplateOutcome> {
  if (!useInstitutionTemplate) return "none";
  try {
    const result = await call("teacher.assignment-template.put", { params: { assignmentId }, query: undefined, body: { useInstitutionTemplate } });
    if (!result.ok) return result.status === 401 ? "signedOut" : result.status === 409 ? "conflict" : "failed";
    return result.body.useInstitutionTemplate === true && result.body.version !== null ? "saved" : "failed";
  } catch {
    return "failed";
  }
}

/** The assignment form's template section: controlled; the form saves the choice after publishing. */
export function TemplateField({ value, onChange, workType, load }: {
  value: boolean; onChange: (next: boolean) => void; workType: string; load: LoadOutline;
}) {
  const [read, setRead] = useState<OutlineRead>({ kind: "loading" });
  useEffect(() => {
    if (!value) return;
    let current = true;
    setRead({ kind: "loading" });
    load(workType).then((next) => { if (current) setRead(next); }, () => { if (current) setRead({ kind: "unavailable" }); });
    return () => { current = false; };
  }, [value, workType, load]);

  return (
    <Section id="zs-template" title={t.reviewLabel}>
      <Checkbox label={t.label} checked={value} hint={value ? t.on : t.off} onChange={(event) => onChange(event.target.checked)} />
      {value && read.kind === "loading" && <p className="meta" role="status">{t.loading}</p>}
      {value && read.kind === "none" && <p className="note">{t.none}</p>}
      {value && read.kind === "unavailable" && <p className="note">{t.unavailable}</p>}
      {value && read.kind === "ready" && (
        <div>
          <p className="meta">{t.version(read.outline.version)}</p>
          <p className="note">{t.titlePage}: {read.outline.titlePage.map((id) => t.titleFields[id]).join(", ") || "–"}</p>
          <p className="note">{t.sections}</p>
          {read.outline.sections.length === 0 ? <p className="meta">{t.noSections}</p> : (
            <ol className="facts">
              {read.outline.sections.map((s, i) => <li key={i}>{s.title}{s.hint ? ` – ${s.hint}` : ""}</li>)}
            </ol>
          )}
        </div>
      )}
    </Section>
  );
}
