import { DeclarationAi, type DeclarationAiState } from "@ductura/ui";
import { useEffect, useMemo, useState } from "react";

import AiDeclarationSection from "../../packages/app/src/host/teacher/ai-declaration/AiDeclarationSection.tsx";
import type { DeclarationPort } from "../../src/client/declaration.ts";
import { createFakeDeclaration } from "../../src/client/declaration-fake.ts";
import styles from "./Catalog.module.css";
import { LABELS } from "./declaration-ai";

const ASSISTANT = "Asistent · Primjer d.o.o., Model A";
const SUBMISSION = "catalog-submission";

const turns = (question: string, answer: string) => [
  { seq: 1, author: "student" as const, text: question },
  { seq: 2, author: "assistant" as const, text: answer },
];

// Invented data. The fake is the only DeclarationPort until declaration-v1 is approved.
const newPort = () => createFakeDeclaration({
  [SUBMISSION]: {
    assistantAllowed: true,
    confirmedAt: "21. 11. 10:00",
    uses: [{ purpose: "Lektura", provider: "Primjer d.o.o., Model A", phase: "Pisanje" }],
    conversations: [
      {
        conversationId: "flow-c1",
        title: "Razgovor 1 · Lektura · 2. 11. 14:05",
        reason: "transfer",
        requiredBecause: "Tekst prenesen u rad, odlomak 2, „iz AI pomoćnika”.",
        assistantName: ASSISTANT,
        throughSeq: 2,
        messagesSha256: "1".repeat(64),
        turns: turns("Možeš li lektorirati ovaj odlomak o izmišljenom primjeru?", "Predlažem blaži poredak rečenica. Izmišljen primjer odgovora."),
      },
      {
        conversationId: "flow-c3",
        title: "Razgovor 3 · Traženje literature · 3. 11. 09:48",
        reason: "student_added",
        assistantName: ASSISTANT,
        throughSeq: 2,
        messagesSha256: "3".repeat(64),
        turns: turns("Koje vrste izvora bih mogao potražiti za izmišljenu temu?", "Možete potražiti pregledne radove. Izmišljen primjer odgovora."),
      },
    ],
  },
});

/**
 * The student's half on the fake port. The host's own step (PIL-K-IZJAVA) runs on declaration-v1;
 * this keeps only the catalogue's flow: the UI component on the port, confirmed or not.
 */
function StudentHalf({ port }: { port: DeclarationPort }) {
  const [state, setState] = useState<DeclarationAiState>({ kind: "loading" });
  const [confirmed, setConfirmed] = useState(false);
  useEffect(() => {
    void port.readStudent(SUBMISSION).then((read) => setState(read.kind === "ready" ? { kind: "ready", uses: read.uses, conversations: read.conversations } : { kind: "error" }));
  }, [port]);
  if (confirmed) return <p role="status">Izjava je potvrđena.</p>;
  return <DeclarationAi labels={LABELS} state={state} onRetry={() => undefined}
    onConfirm={(attachments) => void port.confirm(SUBMISSION, attachments).then((r) => setConfirmed(r.kind === "confirmed"))} />;
}

/**
 * Both containers on one fake (WEB-1209; the teacher's is N-07's AiDeclarationSection): what the student confirms is what the teacher
 * reads. Not a component entry, so it stays out of the coverage and screenshot lists.
 */
export function DeclarationFlow() {
  const fake = useMemo(newPort, []);
  const [confirmations, setConfirmations] = useState(0);
  const port = useMemo<DeclarationPort>(() => ({
    readStudent: (id) => fake.readStudent(id),
    readTeacher: (id) => fake.readTeacher(id),
    confirm: async (id, attachments) => {
      const result = await fake.confirm(id, attachments);
      if (result.kind === "confirmed") setConfirmations((n) => n + 1);
      return result;
    },
  }), [fake]);

  return (
    <section id="DeclarationFlow" aria-labelledby="DeclarationFlow-h" className={styles.component}>
      <h2 id="DeclarationFlow-h">DeclarationFlow</h2>
      <div className={`sheet ${styles.sheet}`} data-sheet-theme="light" data-flow="student">
        <StudentHalf port={port} />
      </div>
      <div className={`sheet ${styles.sheet}`} data-sheet-theme="light" data-flow="teacher">
        <AiDeclarationSection key={confirmations} port={port} submissionId={SUBMISSION} />
      </div>
    </section>
  );
}
