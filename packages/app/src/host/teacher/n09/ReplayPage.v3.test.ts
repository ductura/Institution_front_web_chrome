import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { createBrowserReplayStepsV3 } from "@/client/replay-record/replay-steps";
import { buildReplayPlayer } from "@/client/replay-record/replay-player";
import { buildRecordV3, citeAndFootnote, typeAt, V3_START_JCS } from "@/client/replay-record/replay-record-v3.fixture";
import { messagesHr } from "@/lib/i18n/messages.hr";

import { N09Player } from "./ReplayPage";
import { n09Messages as m } from "./messages.hr";

/**
 * INT-23: the teacher's player over a work of document v3 (synthetic record:
 * invented source, filler text). Before, a v3 work with a citation or a
 * footnote gave only "unavailable" and no controls.
 */

vi.mock("@/client/replay", async (original) => ({
  ...(await original<typeof import("@/client/replay")>()),
  loadReplay: vi.fn(() => new Promise(() => {})),
}));

const text = (markup: string) => markup.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

describe("N09Player over a work of document v3 (INT-23)", () => {
  it("shows the controls and the final text with its citation and footnote", async () => {
    const r = await buildRecordV3([[citeAndFootnote, typeAt(3, " Izmišljena rečenica.")]]);
    const player = await buildReplayPlayer(
      { startDocument: V3_START_JCS, segments: r.segments, head: r.head, resumeDocuments: {} }, createBrowserReplayStepsV3());
    if (!player.ok) throw new Error(player.reason);
    const shown = text(renderToStaticMarkup(h(N09Player, { player })));
    expect(shown).not.toContain(messagesHr.replay.unavailable);
    expect(shown).toContain(m.play);
    expect(shown).toContain(m.next);
    expect(shown).toContain("[Izmišljenić 2021, 7]");
    expect(shown).toContain("[fusnota: Izmišljena bilješka.]");
    expect(shown).toContain("Izmišljena rečenica.");
  });
});
