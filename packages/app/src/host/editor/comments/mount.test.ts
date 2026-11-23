// PIL-K-KOMENTARI-EDITOR: the student's editor mounts the Comments card over the real port in
// the hostSections.comments slot, and no longer the old src/components/editor/CommentPanel.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (...parts: string[]) => readFileSync(join(import.meta.dirname, ...parts), "utf8");
const work = read("..", "..", "student", "work.tsx");
const page = read("..", "..", "..", "..", "..", "..", "src", "components", "editor", "EditorPageWork.tsx");

describe("Comments card in the student's editor", () => {
  it("work.tsx gives the comments slot the CommentsHost and never the old panel", () => {
    expect(work).toMatch(/import \{ CommentsHost \} from "\.\.\/editor\/comments\/CommentsHost"/);
    expect(work).toMatch(/comments: \(\{[^}]*\}\) =>\s*<CommentsHost /);
    expect(work).not.toMatch(/import [^;]*CommentPanel/);
  });
  it("a submitted work mounts the card read only", () => {
    expect(work).toMatch(/<CommentsHost editor=\{null\} documentId=\{receipt\.documentId\} session=\{null\} submitted \/>/);
  });
  it("EditorPageWork renders the host's slot in place of CommentPanel", () => {
    expect(page).toMatch(/comments: hostSections\?\.comments \? hostSections\.comments\(ctx\) : <CommentPanel /);
  });
  it("the port reaches the server only through src/client/comments", () => {
    const port = read("port.ts");
    expect(port).toMatch(/from "@\/client\/comments"/);
    for (const fn of ["listComments", "replyComment", "createComment", "changeThreadState"]) expect(port).toContain(fn);
  });
});
