import { useMemo, useState } from "react";

import StudentDeclaration from "../../packages/app/src/host/student/declaration/StudentDeclaration.tsx";
import TeacherAiAttachmentsPanel from "../../packages/app/src/host/teacher/work/ai-attachments/TeacherAiAttachmentsPanel.tsx";
import type { DeclarationPort } from "../../src/client/declaration.ts";
import { createFakeDeclaration } from "../../src/client/declaration-fake.ts";
import styles from "./Catalog.module.css";

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
 * Both host containers on one fake (WEB-1209): what the student confirms is what the teacher
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
        <StudentDeclaration port={port} submissionId={SUBMISSION} />
      </div>
      <div className={`sheet ${styles.sheet}`} data-sheet-theme="light" data-flow="teacher">
        <TeacherAiAttachmentsPanel key={confirmations} port={port} submissionId={SUBMISSION} />
      </div>
    </section>
  );
}
