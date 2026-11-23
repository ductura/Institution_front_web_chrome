import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { createBrowserReplayStepsV3 } from "@/client/replay-record/replay-steps";
import { buildReplayPlayer } from "@/client/replay-record/replay-player";
import {
  buildRecordV3,
  citeAndFootnote,
  typeAt,
  V3_START_JCS,
  type V3Edit,
} from "@/client/replay-record/replay-record-v3.fixture";
import { messagesHr } from "@/lib/i18n/messages.hr";

import { ReplayPlayerView } from "./ReplayView";
import { atomLabel, nodeText, replayBlocks, replaySources } from "./replay-view";

/**
 * INT-23: the replay view over a work of document v3 (synthetic record:
 * invented source, filler text). Its citations and footnotes are shown in the
 * replayed text, at every change, and never make the player unavailable.
 */

vi.mock("@/client/replay", async (original) => ({
  ...(await original<typeof import("@/client/replay")>()),
  loadReplay: vi.fn(() => new Promise(() => {})),
}));

const t = messagesHr.replay;
const text = (markup: string) => markup.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

async function playerOf(plans: V3Edit[][]) {
  const r = await buildRecordV3(plans);
  const player = await buildReplayPlayer(
    { startDocument: V3_START_JCS, segments: r.segments, head: r.head, resumeDocuments: {} }, createBrowserReplayStepsV3());
  if (!player.ok) throw new Error(player.reason);
  return player;
}

/** The citation and the footnote typed in, then both removed again: the atoms live only in between. */
const removeAtoms: V3Edit = (state) => state.tr.delete(1, 3);

describe("ReplayPlayerView over a work of document v3 (INT-23)", () => {
  it("shows the final text with its citation and footnote, and the controls", async () => {
    const player = await playerOf([[citeAndFootnote, typeAt(3, " Izmišljena rečenica.")]]);
    const shown = text(renderToStaticMarkup(h(ReplayPlayerView, { player })));
    expect(shown).not.toContain(t.unavailable);
    expect(shown).toContain("[Izmišljenić 2021, 7]");
    expect(shown).toContain("[fusnota: Izmišljena bilješka.]");
    expect(shown).toContain("Izmišljena rečenica.");
    expect(shown).toContain(`Korak ${player.total} od ${player.total}`);
  });

  it("reads every document of the record, also one whose atoms are later removed", async () => {
    const player = await playerOf([[citeAndFootnote, typeAt(3, " Tekst.")], [removeAtoms]]);
    const labels: string[] = [];
    for (let n = 0; n <= player.total; n++) {
      const json = player.documentAt(n);
      const nodes = replayBlocks(json);
      // A null here is the player replaced by "unavailable" at that step.
      expect(nodes, `change ${n}`).not.toBeNull();
      for (const child of nodes!.flatMap((node) => node.children)) {
        const label = atomLabel(child, replaySources(json));
        if (label !== null) labels.push(label);
      }
    }
    expect(labels).toContain("[Izmišljenić 2021, 7]");
    expect(labels).toContain("[fusnota: Izmišljena bilješka.]");
    const last = replayBlocks(player.documentAt(player.total))!;
    expect(last.flatMap((node) => node.children).every((child) => child.type === "text")).toBe(true);
    expect(nodeText(last[0]!)).toBe(" Tekst.");
    expect(text(renderToStaticMarkup(h(ReplayPlayerView, { player })))).not.toContain(t.unavailable);
  });

  it("counts a paragraph's text without its atoms, as the record's history does", async () => {
    const player = await playerOf([[citeAndFootnote, typeAt(3, " Tekst.")]]);
    const [node] = replayBlocks(player.documentAt(player.total))!;
    expect(nodeText(node!)).toBe(" Tekst.");
    expect(player.paragraphHistory(node!.id).at(-1)).toMatchObject({ entry: "change", after: " Tekst." });
  });

  it("names a citation of a source the document does not hold, and a cross reference", () => {
    expect(atomLabel({ type: "citation", sourceId: "nepoznat" as never }, [])).toBe(`[${t.atomCitationUnknown}]`);
    expect(atomLabel({ type: "crossReference", targetId: "x" as never }, [])).toBe(t.atomCrossReference);
    expect(atomLabel({ type: "text", text: "a", marks: [] }, [])).toBeNull();
  });
});
