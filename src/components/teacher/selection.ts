/**
 * The marked passage of the live view as block offsets (DAN-86 step 2c).
 * Browser only. A selection counts only when both ends lie in the same
 * block of the text (`[data-node-id]` inside `root`); offsets are the length
 * of the block's text before each end, the same text `blockText` builds.
 * The label drawn for a v3 atom (`[data-atom]`, INT-26) is no part of that
 * text, so its characters are never counted; a v1 block has none.
 */

const ATOM = "[data-atom]";

/** Text nodes of `block` that are its text, not an atom's label. */
function textNodes(block: HTMLElement): Text[] {
  const out: Text[] = [];
  const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (!node.parentElement?.closest(ATOM)) out.push(node as Text);
  }
  return out;
}

export function selectedRange(root: HTMLElement, selection: Selection | null):
  { nodeId: string; start: number; end: number } | null {
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return null;
  const range = selection.getRangeAt(0);
  const block = (node: Node | null) =>
    (node instanceof Element ? node : node?.parentElement ?? null)?.closest<HTMLElement>("[data-node-id]") ?? null;
  const startBlock = block(range.startContainer);
  if (!startBlock || startBlock !== block(range.endContainer) || !root.contains(startBlock)) return null;
  const texts = textNodes(startBlock);
  const offset = (container: Node, at: number) => {
    const before = document.createRange();
    before.selectNodeContents(startBlock);
    before.setEnd(container, at);
    // Every text node wholly before the end counts whole; the one holding the end counts up to it.
    let length = 0;
    for (const text of texts) {
      if (text === container) length += at;
      else if (before.intersectsNode(text)) length += text.length;
    }
    return length;
  };
  const nodeId = startBlock.dataset.nodeId;
  if (!nodeId) return null;
  return { nodeId, start: offset(range.startContainer, range.startOffset), end: offset(range.endContainer, range.endOffset) };
}

/** Selects `start` to `end` of the block's text and brings it into view ("Pokaži u tekstu"). */
export function selectInBlock(root: HTMLElement, nodeId: string, start: number, end: number): boolean {
  const block = [...root.querySelectorAll<HTMLElement>("[data-node-id]")].find((el) => el.dataset.nodeId === nodeId);
  if (!block) return false;
  const range = document.createRange();
  let at = 0;
  let started = false;
  for (const text of textNodes(block)) {
    const length = text.textContent?.length ?? 0;
    if (!started && start <= at + length) {
      range.setStart(text, start - at);
      started = true;
    }
    if (started && end <= at + length) {
      range.setEnd(text, end - at);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
      block.scrollIntoView({ block: "center" });
      return true;
    }
    at += length;
  }
  return false;
}
