"use client";

// WEB-1601: mounts the @ductura/ui toolbar, outline and progress in the editor
// shell from the model of toolbar-model.ts. The shell supplies the editor's
// state and commands; nothing here reads or writes the document.
import { EditorOutline, EditorProgress, EditorToolbar, type ProgressBlock, type WordRange } from "@ductura/ui";

import { currentHeadingId, outlineEntries, progressWords, toolbarGroups, type HeadingInput, type ToolbarCommands, type ToolbarState } from "./toolbar-model";

export function EditorToolbarHost({ state, commands }: { state: ToolbarState; commands: ToolbarCommands }) {
  return <EditorToolbar groups={toolbarGroups(state, commands)} />;
}

export function EditorOutlineHost({ headings, positions, cursor, onGo }: {
  headings: readonly HeadingInput[];
  positions: readonly { id: string; pos: number }[];
  cursor: number;
  onGo: (id: string) => void;
}) {
  return <EditorOutline entries={outlineEntries(headings)} currentId={currentHeadingId(positions, cursor)} onSelect={onGo} />;
}

export function EditorProgressHost({ blocks, range }: { blocks: readonly ProgressBlock[]; range: WordRange | null }) {
  return <EditorProgress words={progressWords(blocks)} range={range} />;
}
