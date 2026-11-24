// WEB-2113: the student host's own copies of what the submission steps take from
// src/components/student/SubmissionView.tsx (TextNode, WorkRead) and
// src/components/student/Submission.tsx (oneAtATime, whileShown). readWork stays
// shared: it checks the text against the server's documentHash before it is shown
// or sent, and one copy of that check is safer than two.

export type TextNode = {
  readonly type: "paragraph" | "heading" | "bulletItem" | "quote";
  readonly level?: number;
  readonly children: readonly { readonly text: string; readonly marks: readonly string[] }[];
};

/** The work as evidence.open.post gives it; `empty`: no text on the server yet. */
export type WorkRead =
  | { readonly kind: "loading" }
  | { readonly kind: "unavailable" }
  | { readonly kind: "empty" }
  | { readonly kind: "ready"; readonly documentId: string; readonly revision: number; readonly nodes: readonly TextNode[] };

/** Runs `send` once at a time: a call while one is on its way gets null and sends nothing. */
export function oneAtATime<A, T>(send: (input: A) => Promise<T>): (input: A) => Promise<T | null> {
  let busy = false;
  return async (input) => {
    if (busy) return null;
    busy = true;
    try {
      return await send(input);
    } finally {
      busy = false;
    }
  };
}

/**
 * Follows an answer only while the page that asked is still shown. After Back
 * or any other way out, a late answer neither navigates nor draws anything.
 */
export function whileShown<A>(shown: { readonly current: boolean }, follow: (answer: A) => void): (answer: A | null) => void {
  return (answer) => {
    if (answer !== null && shown.current) follow(answer);
  };
}
