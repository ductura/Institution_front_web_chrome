"use client";

// WEB-V20-STIL-ODABIR: the citation style of the institution, read once for an assignment from
// student.text-check-config.get (field citationStyle). Display only: the student does not choose, and the
// style comes from the session, so there is no institution to pass. Three outcomes, kept apart:
//  - style: the institution's style;
//  - fallback: the id is not available here (e.g. fusnote), the default FPZG style is used;
//  - error: the read failed (not "no data"); the consumer shows its own note and keeps FPZG.
import { useEffect, useState } from "react";

import { createApi } from "../../../../../../src/client/api.ts";
import type { CitationStyle } from "../../../../../editor-core/src/document/citation/index.ts";
import { citationStyleOf, DEFAULT_STYLE_ID, isStyleId, type StyleId } from "./catalog";

export type InstitutionStyle =
  | { readonly kind: "style"; readonly id: StyleId; readonly style: CitationStyle }
  | { readonly kind: "fallback"; readonly id: StyleId; readonly style: CitationStyle }
  | { readonly kind: "error" };

export type InstitutionStyleRead = { readonly kind: "loading" } | InstitutionStyle;

type StyleCall = (
  id: "student.text-check-config.get",
  input: { readonly params: { readonly assignmentId: string }; readonly query: undefined; readonly body: undefined },
) => Promise<{ ok: boolean; status: number; body?: unknown }>;

const fallback = (): InstitutionStyle => ({ kind: "fallback", id: DEFAULT_STYLE_ID, style: citationStyleOf(DEFAULT_STYLE_ID)! });

/** Reads the style through the shared client. Anything but a 200 with a body is "error", never "empty". */
export async function readInstitutionStyle(call: StyleCall, assignmentId: string): Promise<InstitutionStyle> {
  let answer: Awaited<ReturnType<StyleCall>>;
  try {
    answer = await call("student.text-check-config.get", { params: { assignmentId }, query: undefined, body: undefined });
  } catch {
    return { kind: "error" };
  }
  if (!answer.ok || answer.status !== 200) return { kind: "error" };
  if (typeof answer.body !== "object" || answer.body === null) return { kind: "error" };
  const id = (answer.body as { citationStyle?: unknown }).citationStyle;
  if (isStyleId(id)) return { kind: "style", id, style: citationStyleOf(id)! };
  return fallback();
}

export const liveInstitutionStyle = (assignmentId: string) =>
  readInstitutionStyle(createApi() as unknown as StyleCall, assignmentId);

export function useInstitutionStyle(assignmentId: string): InstitutionStyleRead {
  const [state, setState] = useState<{ for: string; read: InstitutionStyle } | null>(null);
  useEffect(() => {
    let live = true;
    void liveInstitutionStyle(assignmentId).then((read) => { if (live) setState({ for: assignmentId, read }); });
    return () => { live = false; };
  }, [assignmentId]);
  return state !== null && state.for === assignmentId ? state.read : { kind: "loading" };
}
