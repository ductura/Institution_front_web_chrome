"use client";

import { OptionGroup } from "@ductura/ui";

import { documentKindHr as k } from "./messages.hr";

export type DocumentKind = "text" | "slides" | "spreadsheet";
export const DOCUMENT_KINDS: readonly DocumentKind[] = ["text", "slides", "spreadsheet"];

/** The kind of the document the student writes (WEB-V13-VRSTA-ZADATKA): text unless the teacher picks slides or a table. */
export function kindOf(value: unknown): DocumentKind {
  return value === "slides" || value === "spreadsheet" ? value : "text";
}

/**
 * The create body with the kind: the contract field `documentKind` (SRV-V13-UGOVOR-VRSTA), always sent so the
 * default "text" is explicit on the wire. The caller's draft holds nothing else than the two contract values.
 */
export function withDocumentKind<T extends object>(body: T, draft: { documentKind?: DocumentKind }): T & { documentKind: "text" | "slides"; workKind?: "spreadsheet" } {
  const kind = kindOf(draft.documentKind);
  // WEB-V14-SHEET-PAGE (SRV-V14-KIND-ENUM v2, decision b): the enum `documentKind` is not widened; a table is
  // `workKind: "spreadsheet"` beside the always-sent `documentKind: "text"`. The client reads `workKind ?? documentKind`.
  return kind === "spreadsheet" ? { ...body, documentKind: "text", workKind: "spreadsheet" } : { ...body, documentKind: kind };
}

/** The "Vrsta dokumenta" choice of the form: "Tekst" (default) or "Slajdovi". */
export function DocumentKindField({ value, onChange }: { value: DocumentKind; onChange: (value: DocumentKind) => void }) {
  return (
    <>
      <OptionGroup legend={k.legend} name="document-kind" value={value}
        options={DOCUMENT_KINDS.map((kind) => ({ value: kind, label: k.options[kind] }))}
        onChange={(picked) => onChange(kindOf(picked))} />
      <p className="meta">{value === "slides" ? k.slidesHint : value === "spreadsheet" ? k.spreadsheetHint : k.textHint}</p>
    </>
  );
}

/**
 * The kind on the edit page (a new version of the assignment). The read of the current version names no kind yet,
 * so it is shown only when the server gave one; otherwise it says honestly that the kind is not shown.
 */
export function DocumentKindReadBack({ current }: { current: object }) {
  const row = current as { documentKind?: unknown; workKind?: unknown };
  const given = row.workKind ?? row.documentKind;
  const known = given === "text" || given === "slides" || given === "spreadsheet";
  return (
    <p className="meta" data-testid="document-kind-readback">
      <strong>{k.legend}:</strong> {known ? k.options[given as DocumentKind] : k.unknown} {k.fixed}
    </p>
  );
}
