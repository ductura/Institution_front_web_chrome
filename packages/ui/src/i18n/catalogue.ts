import { diffMessages } from "../components/diff-view/messages.hr";
import { objectToolbarHr } from "../components/object-toolbar/messages.hr";
import { previewDialogHr } from "../components/preview-dialog/messages.hr";
import { searchableListHr } from "../components/searchable-list/messages.hr";
import { sourceFormHr } from "../components/source-form/messages.hr";
import { timelineMessages } from "../components/timeline/messages.hr";
import { fingerprintMessages } from "../fingerprint/messages.hr";
import { stateTagMessages } from "../state-tag/messages.hr";
import { stepLabels } from "../steps/messages.hr";
import { tableMessages } from "../table/messages.hr";

import { uiMessagesEn } from "./en";
import type { UiLocale } from "./locale";

/**
 * Every text table of the UI package's own components, by section. The
 * Croatian sections stay next to their components; the English ones are in
 * `./en.ts`, and `i18n.test.ts` checks that both have the same keys.
 */
export const uiMessagesHr = {
  diff: diffMessages,
  objectToolbar: objectToolbarHr,
  previewDialog: previewDialogHr,
  searchableList: searchableListHr,
  sourceForm: sourceFormHr,
  timeline: timelineMessages,
  fingerprint: fingerprintMessages,
  stateTag: stateTagMessages,
  steps: stepLabels,
  table: tableMessages,
};

export type UiMessages = typeof uiMessagesHr;

export { uiMessagesEn };

export function uiMessagesFor(locale: UiLocale): UiMessages {
  return (locale === "en" ? uiMessagesEn : uiMessagesHr) as UiMessages;
}
