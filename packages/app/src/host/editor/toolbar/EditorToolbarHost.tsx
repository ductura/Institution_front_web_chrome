"use client";

// WEB-1601: mounts the @ductura/ui toolbar, outline and progress in the editor
// shell from the model of toolbar-model.ts. The shell supplies the editor's
// state and commands; nothing here reads or writes the document.
// WEB-2131: with `behaviour` the toolbar gets tool tips, the look of the buttons, Više, customising and the
// context button (ToolbarBehaviour.tsx); without it the plain toolbar of WEB-1601 is drawn.
import { EditorOutline, EditorProgress, EditorToolbar, type ProgressBlock, type WordRange } from "@ductura/ui";

import type { ContextAction, CursorPlace } from "./context-button";
import { ToolbarWithBehaviour } from "./ToolbarBehaviour";
import { currentHeadingId, outlineEntries, progressWords, toolbarGroups, type HeadingInput, type ToolbarCommands, type ToolbarState } from "./toolbar-model";
import type { ToolbarPrefs } from "./toolbar-prefs";

export type ToolbarBehaviourInput = {
  prefs: ToolbarPrefs;
  onPrefs: (next: ToolbarPrefs) => void;
  collapsed?: readonly string[];
  place?: CursorPlace;
  intro?: "write" | "review" | "locked";
  onContextAction?: (id: ContextAction) => void;
};

export function EditorToolbarHost({ state, commands, behaviour, labels, omit }: {
  state: ToolbarState; commands: ToolbarCommands; behaviour?: ToolbarBehaviourInput;
  /** Accessible names the shell keeps from the toolbar it replaces (PIL-K-TRAKA), by action id. */
  labels?: Readonly<Record<string, string>>;
  /** Action ids the shell's editor cannot do (e.g. the numbered list the V2 schema lacks). */
  omit?: readonly string[];
}) {
  const groups = toolbarGroups(state, commands)
    .map((g) => ({ ...g, actions: g.actions.filter((a) => !omit?.includes(a.id)).map((a) => (labels?.[a.id] ? { ...a, label: labels[a.id]! } : a)) }))
    .filter((g) => g.actions.length > 0);
  if (!behaviour) return <EditorToolbar groups={groups} />;
  return <ToolbarWithBehaviour groups={groups} editable={state.editable} {...behaviour} />;
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
