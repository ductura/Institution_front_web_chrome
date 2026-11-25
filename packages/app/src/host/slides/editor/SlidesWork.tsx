"use client";

// WEB-V13-UREDNIK: the work page of a slides work, mounted by host/student/work.tsx
// (one branch on the kind). It holds the editor in the frame of the text page
// (top bar, sheet, status bar). The document is revision 0 until the journal and
// sync of WEB-V13-DNEVNIK-SINKRONIZACIJA exist, so the status bar claims no save
// state; an unreadable kind shows the editor's error with a retry.
import type { ReactNode } from "react";
import EditorPage from "../../../../../../src/components/editor/EditorPage.tsx";
import StatusBar from "../../../../../../src/components/editor/StatusBar.tsx";
import { slidesRevisionZeroDocument } from "../../../../../editor-core/src/slides/index.ts";
import { SlideEditor } from "./SlideEditor.tsx";

export function SlidesWork({ course, title, topBar, length, unreadable, onRetry }: {
  course: string | null;
  title: string | null;
  topBar: ReactNode;
  length: React.ComponentProps<typeof StatusBar>["length"];
  unreadable: boolean;
  onRetry: () => void;
}) {
  return (
    <EditorPage course={course} title={title} topBar={topBar} status={<StatusBar save={null} readOnly={false} length={length} />}>
      <SlideEditor source={unreadable ? { kind: "error", onRetry } : { kind: "ready", doc: slidesRevisionZeroDocument() }} />
    </EditorPage>
  );
}
