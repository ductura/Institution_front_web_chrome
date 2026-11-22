// Probe port for the tests and the catalogue until the interview route exists. Invented data.
import type { InterviewExplanation, InterviewPort, InterviewRead } from "./port";

export function fakeInterviewPort(invited = true): InterviewPort & { readonly explained: string[]; readonly notes: string[] } {
  const explained: string[] = [];
  const notes: string[] = [];
  const explanations: InterviewExplanation[] = [];
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
        slot: null, heldAt: null, explanations, attachments: [...notes],
      };
    },
    async explain(_id, input) { explained.push(input.text); explanations.push({ id: `e${explanations.length}`, questionId: input.questionId, text: input.text }); return { kind: "saved" }; },
    async attachNote(_id, file) { notes.push(file.name); return { kind: "saved" }; },
  };
}
