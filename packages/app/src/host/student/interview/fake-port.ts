// Probe port for the tests and the catalogue; the real one is studentInterviewPort (port.ts). Invented data.
import type { InterviewExplanation, InterviewNote, InterviewPort, InterviewRead } from "./port";

export function fakeInterviewPort(invited = true): InterviewPort & { readonly explained: string[]; readonly notes: string[] } {
  const explained: string[] = [];
  const notes: string[] = [];
  const explanations: InterviewExplanation[] = [];
  const attachments: InterviewNote[] = [];
  return {
    explained, notes,
    async read(): Promise<InterviewRead> {
      if (!invited) return { kind: "notInvited" };
      return {
        kind: "ready", workTitle: "Izmišljeni seminar o hrvatskim rijekama",
        questions: [
          { id: "q1", paragraphRef: "p3", paragraphExcerpt: "Izmišljeni odlomak o Savi.", text: "Kako si došao do ovog zaključka?" },
          { id: "q0", paragraphRef: null, text: "Koje si izvore koristio?" },
        ],
        slot: null, heldAt: null, explanations, attachments: [...attachments],
      };
    },
    async explain(_id, input) {
      explained.push(input.text);
      const explanation = { id: `e${explanations.length}`, questionId: input.questionId, text: input.text };
      explanations.push(explanation);
      return { kind: "saved", explanation };
    },
    async attachNote(_id, upload) {
      notes.push(upload.fileName);
      const note = { id: `n${attachments.length}`, fileName: upload.fileName };
      attachments.push(note);
      return { kind: "saved", note };
    },
  };
}
