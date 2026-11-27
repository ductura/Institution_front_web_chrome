// In-memory stand-in for the teacher's interview routes (WEB-1530); invented ids, text and times only.
import type { InterviewTeacherPort, InterviewPreparation } from "./port";

const Q1 = "3c9f0a1e-7b2d-4e5f-8a6b-1c2d3e4f5a61";
const NOW = "2026-11-22T09:00:00.000Z";

export const FAKE_PREPARATION: InterviewPreparation = {
  invitedAt: null,
  questions: [{ id: Q1, paragraphRef: "3", questionText: "Kako si došao do ove tvrdnje?", createdAt: NOW, mine: true }],
  explanations: [],
  appointment: null,
  heldOn: null,
};

export function fakeTeacherPort(initial: InterviewPreparation = FAKE_PREPARATION) {
  let state: InterviewPreparation = initial;
  let counter = 0;
  const calls: string[] = [];
  const port: InterviewTeacherPort & { readonly calls: readonly string[] } = {
    calls,
    read: async () => ({ kind: "ok", value: state }),
    addQuestion: async (_id, { paragraphRef, questionText }) => {
      calls.push(`add:${questionText}`);
      counter += 1;
      const id = `3c9f0a1e-7b2d-4e5f-8a6b-1c2d3e4f5b${String(counter).padStart(2, "0")}`;
      state = { ...state, questions: [...state.questions, { id, paragraphRef, questionText, createdAt: NOW, mine: true }] };
      return { kind: "ok", value: null };
    },
    removeQuestion: async (_id, questionId) => {
      calls.push(`remove:${questionId}`);
      state = { ...state, questions: state.questions.filter((q) => q.id !== questionId) };
      return { kind: "ok", value: null };
    },
    invite: async () => { calls.push("invite"); state = { ...state, invitedAt: NOW }; return { kind: "ok", value: state }; },
    setAppointment: async (_id, body) => {
      calls.push("appointment");
      state = { ...state, appointment: "place" in body ? { place: body.place, at: body.at } : { consultationSlotId: body.consultationSlotId, startsAt: NOW } };
      return { kind: "ok", value: state };
    },
    markHeld: async (_id, date) => { calls.push(`held:${date}`); state = { ...state, heldOn: date }; return { kind: "ok", value: state }; },
    pdf: async () => ({ kind: "ok", value: { filename: "priprema-za-razgovor.pdf", pdfBase64: "JVBERi0=" } }),
  };
  return port;
}
