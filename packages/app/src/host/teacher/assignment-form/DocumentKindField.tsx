"use client";

import { OptionGroup } from "@ductura/ui";

import { documentKindHr as k } from "./messages.hr";

export type DocumentKind = "text" | "slides";
export const DOCUMENT_KINDS: readonly DocumentKind[] = ["text", "slides"];

/** The kind of the document the student writes (WEB-V13-VRSTA-ZADATKA): text unless the teacher picks slides. */
export function kindOf(value: unknown): DocumentKind {
  return value === "slides" ? "slides" : "text";
}

/**
 * The create body with the kind: the contract field `documentKind` (SRV-V13-UGOVOR-VRSTA), always sent so the
 * default "text" is explicit on the wire. The caller's draft holds nothing else than the two contract values.
 */
export function withDocumentKind<T extends object>(body: T, draft: { documentKind?: DocumentKind }): T & { documentKind: DocumentKind } {
  return { ...body, documentKind: kindOf(draft.documentKind) };
}

/** The "Vrsta dokumenta" choice of the form: "Tekst" (default) or "Slajdovi". */
export function DocumentKindField({ value, onChange }: { value: DocumentKind; onChange: (value: DocumentKind) => void }) {
  return (
    <>
      <OptionGroup legend={k.legend} name="document-kind" value={value}
        options={DOCUMENT_KINDS.map((kind) => ({ value: kind, label: k.options[kind] }))}
        onChange={(picked) => onChange(kindOf(picked))} />
      <p className="meta">{value === "slides" ? k.slidesHint : k.textHint}</p>
    </>
  );
}

/**
 * The kind on the edit page (a new version of the assignment). The read of the current version names no kind yet,
 * so it is shown only when the server gave one; otherwise it says honestly that the kind is not shown.
 */
export function DocumentKindReadBack({ current }: { current: object }) {
  const given = (current as { documentKind?: unknown }).documentKind;
  const known = given === "text" || given === "slides";
  return (
    <p className="meta" data-testid="document-kind-readback">
      <strong>{k.legend}:</strong> {known ? k.options[given as DocumentKind] : k.unknown} {k.fixed}
    </p>
  );
}
