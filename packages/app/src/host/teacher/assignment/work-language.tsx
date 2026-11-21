"use client";

import { readWorkLanguage, writeWorkLanguage } from "@/client/teacher-assignment";
import { workLanguageExceptionHref } from "@/components/teacher/links";
import WorkLanguageExceptionCard from "@/components/teacher/WorkLanguageExceptionCard";
import { messagesHr } from "@/lib/i18n/messages.hr";

import { AssignmentPage, useAssignmentRead } from "./page-state";

const t = messagesHr.teacher.workLanguageException;

export default function WorkLanguagePage({ assignmentId, documentId }: { assignmentId: string; documentId: string }) {
  const path = workLanguageExceptionHref(assignmentId, documentId) ?? "/nastavnik";
  const [read, retry] = useAssignmentRead(path, () => readWorkLanguage(assignmentId, documentId));

  return (
    <AssignmentPage title={t.title} read={read} retry={retry} unavailable={t.unavailable} missing={t.notFound}>
      {({ title, assignmentLanguage, exception }) => (
        <>
          <p>{title}</p>
          <WorkLanguageExceptionCard assignmentId={assignmentId} documentId={documentId}
            assignmentLanguage={assignmentLanguage} exception={exception} onReload={retry}
            saveLanguage={(language) => writeWorkLanguage(assignmentId, documentId, language)} />
        </>
      )}
    </AssignmentPage>
  );
}
