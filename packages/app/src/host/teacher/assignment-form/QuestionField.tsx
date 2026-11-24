"use client";

import { TextArea } from "@ductura/ui";

import { declarationQuestionHr as t } from "./messages.hr";

/** OD-4: the question's limit in declaration-v1 (Unicode code points), named. */
export const DECLARATION_QUESTION_MAX_CHARS = 500;

/**
 * NF-4 NZ-15: where the teacher would ask the student a question beside the declaration (NF-3
 * PR-20). The server shows the question and takes the answer (declaration-v1), but no route of
 * the assignment sets it yet, so the field stands disabled and says so; it never pretends to save.
 */
export function QuestionField({ prefix = "zs" }: { prefix?: string }) {
  return (
    <div data-nf4="NZ-15">
      <TextArea name={`${prefix}-question`} label={t.label} value="" disabled readOnly rows={undefined}
        hint={t.hint.replace("{max}", DECLARATION_QUESTION_MAX_CHARS.toLocaleString("hr-HR"))} />
      <p className="meta" role="note">{t.unavailable}</p>
    </div>
  );
}
