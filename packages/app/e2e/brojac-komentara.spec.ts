// ED-38 (P2-7): the "Komentari" card of the editor's right panel says how many comments are open in the
// text, as the prototype's `.cnt`. The server is the VIZ "puno" scenario; the comment list is answered here
// with one open and one resolved thread anchored on the work's first paragraph with text, read from the
// paragraph the editor drew. Every person, text and identifier is invented.
import { expect, test, type Page } from "./fixtures/test";
import { FIKSNI_DATUM, T1 } from "../test-fakes/viz-scenariji";
import { generatedServer } from "./viz/server";

type Paragraph = { nodeId: string; text: string };

const thread = (n: number, state: "open" | "resolved", at: Paragraph) => ({
  threadId: `00000000-0000-4000-8000-0000000000e${n}`, commentId: `00000000-0000-4000-8000-0000000000f${n}`, position: 1,
  authorRole: "teacher", isOwn: false, body: `Izmišljeni komentar ${n}.`, state,
  createdWindow: "2026-11-04T10:00:00.000Z", deletedWindow: null,
  anchor: { nodeId: at.nodeId, quote: at.text.slice(0, 10), prefix: "", suffix: at.text.slice(10, 20), startHint: 0, endHint: 10 },
});

async function student(page: Page, comments: () => Promise<unknown[]>) {
  const server = generatedServer("puno");
  await page.clock.setFixedTime(new Date(FIKSNI_DATUM));
  await page.route("**/api/v1/**", async (route) => {
    const req = route.request();
    const path = new URL(req.url()).pathname;
    if (req.method() === "POST" && path.endsWith("/comments/list")) return route.fulfill({ json: { comments: await comments() } });
    const result = server.answer("student", req.method(), path);
    return result === "hang" ? undefined : route.fulfill(result);
  });
}

async function skipGuide(page: Page) {
  const skip = page.getByRole("button", { name: "Preskoči vodič" });
  await skip.waitFor({ state: "visible", timeout: 5000 }).then(() => skip.click(), () => undefined);
}

test("ED-38: Komentari counts the open comments in the text, not the resolved ones", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  // The comment list is held until the test has read the paragraph to anchor on, then answered: a reload
  // would draw the paragraphs with new ids.
  let found: (at: Paragraph) => void = () => undefined;
  const anchored = new Promise<Paragraph>((resolve) => { found = resolve; });
  await student(page, async () => {
    const at = await anchored;
    return [thread(1, "open", at), thread(2, "resolved", at)];
  });

  await page.goto(`/app/web/rad/${T1}`);
  await skipGuide(page);
  const tab = page.getByRole("tab", { name: /^Komentari/ });
  await expect(tab).toBeVisible();
  // No comments yet (the list is still held): the bare name, never a 0.
  await expect(tab).toHaveText("Komentari");

  // The first paragraph of the work with some text, as the editor drew it (its node id and words). The
  // editor's own widgets (contenteditable=false) are drawn inside a paragraph but are not its text.
  const drawn = page.locator(".ProseMirror p[data-node-id]");
  await expect(drawn.first()).toBeVisible();
  const paragraph = await drawn.evaluateAll((nodes) => {
    const own = (node: Element) => {
      const copy = node.cloneNode(true) as Element;
      copy.querySelectorAll("[contenteditable=false]").forEach((widget) => widget.remove());
      return copy.textContent ?? "";
    };
    const hit = nodes.find((node) => own(node).trim().length >= 20);
    return hit ? { nodeId: hit.getAttribute("data-node-id") ?? "", text: own(hit) } : null;
  });
  expect(paragraph, "the scenario's work has a paragraph to anchor on").not.toBeNull();

  found(paragraph!);
  await expect(tab).toHaveAccessibleName("Komentari (1 otvoren komentar)");
  await expect(tab.locator(".panel-tabs__count")).toHaveText("1");
});
