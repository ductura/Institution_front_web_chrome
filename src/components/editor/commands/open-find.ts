import { createContext, useContext } from "react";

/**
 * ED-34 (P2-9): opens the editor's "Traži i zamijeni" row, the same one Ctrl+F opens. Given by EditorCommands to
 * the tools inside it (the student's toolbar has a "Traži" button); null outside EditorCommands.
 */
export const OpenFindContext = createContext<(() => void) | null>(null);

export function useOpenFind(): (() => void) | null {
  return useContext(OpenFindContext);
}
