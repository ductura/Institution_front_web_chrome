"use client";

// PIL-K-SADRZAJ: the live table of contents (WEB-1602) in the left panel of the
// student's editor. The left panel's sections are given by document id only, so
// this reads the open editor from the document provider and hands it to the host.
import type { TocEditor } from "../../../../../editor-core/src/outline/index.ts";
import { useLocalEditor } from "../../../../../../src/components/editor/LocalDocument.tsx";

import { TableOfContentsHost } from "./TableOfContentsHost";

export function TableOfContentsMount() {
  const editor = useLocalEditor();
  return <TableOfContentsHost editor={editor as unknown as TocEditor | null} />;
}
