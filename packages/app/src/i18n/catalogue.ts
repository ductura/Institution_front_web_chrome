import { messagesFor as interfaceMessagesFor } from "../../../../src/components/i18n/locale.ts";
import type { Messages as InterfaceMessages } from "../../../../locales/hr.ts";
import { messagesFor as workMessagesFor } from "../../../../src/lib/i18n/locale.ts";
import type { Messages as WorkMessages } from "../../../../src/lib/i18n/messages.hr.ts";
import { uiMessagesFor, type UiLocale, type UiMessages } from "@ductura/ui";

import { messagesHr as institutionHr } from "../host/institution/messages.hr";
import { declarationLabels, declarationStatus } from "../host/student/declaration/messages.hr";
import { noticeReadText } from "../host/student/notice/messages.hr";
import { teacherAiLabels } from "../host/teacher/work/ai-attachments/messages.hr";
import { teacherWorkMessages } from "../host/teacher/work/messages.hr";
import { hostText } from "../text";
import {
  accessDeniedEn, declarationLabelsEn, declarationStatusEn, hostTextEn, institutionEn, noticeReadEn, pageLabelsEn, profileEn, teacherAiLabelsEn, teacherWorkEn,
} from "./messages.en";
import { accessDeniedHr, pageLabelsHr, profileHr } from "./messages.hr";

/**
 * Every text table of the app's own screens, by section. The Croatian
 * sections stay next to their screens; the English ones are in
 * `./messages.en.ts`.
 */
export const appMessagesHr = {
  host: hostText,
  accessDenied: accessDeniedHr,
  profile: profileHr,
  pages: pageLabelsHr,
  institution: institutionHr,
  declarationLabels,
  declarationStatus,
  noticeRead: noticeReadText,
  teacherAi: teacherAiLabels,
  teacherWork: teacherWorkMessages,
};

export const appMessagesEn = {
  host: hostTextEn,
  accessDenied: accessDeniedEn,
  profile: profileEn,
  pages: pageLabelsEn,
  institution: institutionEn,
  declarationLabels: declarationLabelsEn,
  declarationStatus: declarationStatusEn,
  noticeRead: noticeReadEn,
  teacherAi: teacherAiLabelsEn,
  teacherWork: teacherWorkEn,
};

export type AppMessages = typeof appMessagesHr;

/** All texts of one language: the interface catalogue (locales/), the work catalogue (src/lib), the UI package and the app. */
export type Catalogues = {
  readonly t: InterfaceMessages;
  readonly work: WorkMessages;
  readonly ui: UiMessages;
  readonly app: AppMessages;
};

export function cataloguesFor(locale: UiLocale): Catalogues {
  return {
    t: interfaceMessagesFor(locale),
    work: workMessagesFor(locale),
    ui: uiMessagesFor(locale),
    app: locale === "en" ? (appMessagesEn as unknown as AppMessages) : appMessagesHr,
  };
}
