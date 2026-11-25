"use client";

// WEB-V21-STEM-KOD-BLOK: blok koda u studentskom editoru. `useCodeBlockHost` crta blokove (brojevi redaka,
// naslov ispisa, bojenje lokalnom bibliotekom), otvara dijalog za „Blok koda…” i primjenjuje rezultat kroz
// code-commands. Samo prikaz i uređivanje teksta; ništa se ne izvršava i ništa ne ide na poslužitelj.
// Akcije uz blok (npr. „Pokreni testove”) dolaze preko prop-a `actions`, koji puni zadatak 13.
import type { Editor } from "@tiptap/core";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

import { CodeBlockDialog } from "./CodeBlockDialog.tsx";
import { codeBlockPos, currentCodeBlockProps, insertCodeBlock, updateCodeBlock, type CodeBlockProps } from "./code-commands.ts";
import { codeBlockAvailability, codeViewKey, codeViewPlugin, supportsCodeBlocks, type CodeBlockActions, type CodeBlockAvailability } from "./code-view.ts";

type Session = { pos: number | null; initial: CodeBlockProps | null };

export type CodeBlockHostApi = {
  availability: CodeBlockAvailability;
  /** Otvara dijalog za novi blok (ili za blok oko odabira, `change`); false kad je stavka isključena. */
  open: (change?: boolean) => boolean;
  /** Stoji li odabir u bloku koda (za stavku „Svojstva bloka koda…”). */
  inBlock: boolean;
  dialog: ReactNode;
};

export function useCodeBlockHost(editor: Editor | null, schemaVersion: number | undefined, actions?: CodeBlockActions): CodeBlockHostApi {
  const live = !!editor && !editor.isDestroyed;
  const availability: CodeBlockAvailability = live ? codeBlockAvailability(editor.schema, schemaVersion, editor.isEditable) : { enabled: false, reason: "" };
  const [session, setSession] = useState<Session | null>(null);
  const available = useRef(availability.enabled);
  available.current = availability.enabled;
  const supported = live && supportsCodeBlocks(editor.schema, schemaVersion);

  useEffect(() => {
    if (!editor || editor.isDestroyed || !supported) return;
    // A new `actions` re-registers the plugin, which makes ProseMirror redraw every block (new buttons, no stale `run`).
    editor.registerPlugin(codeViewPlugin(() => actions));
    return () => { if (!editor.isDestroyed) editor.unregisterPlugin(codeViewKey); };
  }, [editor, supported, actions]);

  const open = useCallback((change = false) => {
    if (!available.current || !editor) return false;
    if (change) {
      const pos = codeBlockPos(editor);
      if (pos === null) return false;
      setSession({ pos, initial: currentCodeBlockProps(editor) });
    } else setSession({ pos: null, initial: null });
    return true;
  }, [editor]);

  const confirm = (props: CodeBlockProps): boolean => {
    if (!session) return false;
    const applied = session.pos === null ? insertCodeBlock(editor, props) : updateCodeBlock(editor, session.pos, props);
    if (applied) { setSession(null); editor?.commands.focus(); }
    return applied;
  };
  const dialog = session
    ? <CodeBlockDialog open initial={session.initial} onConfirm={confirm} onClose={() => { setSession(null); editor?.commands.focus(); }} />
    : null;
  return { availability, open, inBlock: live && codeBlockPos(editor) !== null, dialog };
}
