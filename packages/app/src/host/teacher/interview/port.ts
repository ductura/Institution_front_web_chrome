// The teacher's port of the interview preparation (WEB-1530). The page talks only to this port;
// the real one answers through src/client, the fake one through memory.
import type { InterviewAppointmentInput, InterviewOutcome, InterviewPreparation, InterviewQuestion } from "../../../../../../src/client/work-interview";
import {
  addInterviewQuestion, inviteToInterview, markInterviewHeld, readInterview, readInterviewPdf, removeInterviewQuestion, setInterviewAppointment,
} from "../../../../../../src/client/work-interview";

export type { InterviewAppointmentInput, InterviewOutcome, InterviewPreparation, InterviewQuestion };
export type InterviewPdfFile = { readonly filename: string; readonly pdfBase64: string };

export interface InterviewTeacherPort {
  read(documentId: string): Promise<InterviewOutcome<InterviewPreparation>>;
  addQuestion(documentId: string, input: { paragraphRef: string | null; questionText: string }): Promise<InterviewOutcome<unknown>>;
  removeQuestion(documentId: string, questionId: string): Promise<InterviewOutcome<unknown>>;
  invite(documentId: string): Promise<InterviewOutcome<InterviewPreparation>>;
  setAppointment(documentId: string, input: InterviewAppointmentInput): Promise<InterviewOutcome<InterviewPreparation>>;
  markHeld(documentId: string, date: string): Promise<InterviewOutcome<InterviewPreparation>>;
  pdf(documentId: string): Promise<InterviewOutcome<InterviewPdfFile>>;
}

export const interviewPort: InterviewTeacherPort = {
  read: (id) => readInterview(id),
  addQuestion: (id, input) => addInterviewQuestion(id, input),
  removeQuestion: (id, questionId) => removeInterviewQuestion(id, questionId),
  invite: (id) => inviteToInterview(id),
  setAppointment: (id, input) => setInterviewAppointment(id, input),
  markHeld: (id, date) => markInterviewHeld(id, date),
  pdf: (id) => readInterviewPdf(id),
};
