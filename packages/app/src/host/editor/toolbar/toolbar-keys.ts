// WEB-2131: which of the editor's moving shortcuts a key press is (the keys are listed in shortcut-definitions.ts).
// Alt+↑/↓ moves the sentence, Alt+Shift+↑/↓ the chapter, Ctrl/Cmd+Alt+M starts a comment.
export type KeyAction = "comment" | "sentenceUp" | "sentenceDown" | "chapterUp" | "chapterDown";
type KeyLike = { key: string; altKey: boolean; shiftKey: boolean; ctrlKey: boolean; metaKey: boolean };

export function keyAction(e: KeyLike, mac = false): KeyAction | null {
  const mod = mac ? e.metaKey : e.ctrlKey;
  if (e.altKey && mod && !e.shiftKey && e.key.toLowerCase() === "m") return "comment";
  // The prototype also takes Alt+Ctrl for the chapter; Alt alone is the sentence.
  if (e.altKey && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
    const up = e.key === "ArrowUp";
    if (e.shiftKey || e.ctrlKey) return up ? "chapterUp" : "chapterDown";
    if (!e.metaKey) return up ? "sentenceUp" : "sentenceDown";
  }
  return null;
}
