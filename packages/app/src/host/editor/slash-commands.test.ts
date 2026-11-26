import { describe, expect, it, vi } from "vitest";

import { triggerItems } from "@/components/editor/triggers/items";
import { offerSlashCommands, slashCommandsOf } from "./slash-commands";

const slash = (query: string) => ({ mode: "slash" as const, query, from: 0, to: query.length + 1 });

describe("ED-46: \"/\" naredbe iz dijaloga trake", () => {
  it("bez ponude /fusnota i /ref ostaju onemogućene, s razlogom", () => {
    const items = triggerItems(slash(""), [], { commands: slashCommandsOf({}) }, () => {});
    for (const id of ["fusnota", "ref"]) {
      const item = items.find((i) => i.id === id);
      expect(item?.disabled).toBe(true);
      expect(item?.hint).toContain("nije u pilotu");
    }
  });

  it("ponuda trake otvara isti dijalog kao Umetni", () => {
    const editor = {};
    const footnote = vi.fn();
    const withdraw = offerSlashCommands(editor, { fusnota: footnote });
    const items = triggerItems(slash("fus"), [], { commands: slashCommandsOf(editor) }, () => {});
    expect(items.map((i) => i.id)).toEqual(["fusnota"]);
    expect(items[0]?.disabled).toBe(false);
    items[0]?.run?.();
    expect(footnote).toHaveBeenCalledOnce();
    withdraw();
    expect(slashCommandsOf(editor)).toEqual({});
  });

  it("ponuda vrijedi samo za svoj editor, a stara ponuda ne briše noviju", () => {
    const a = {};
    const b = {};
    const first = offerSlashCommands(a, { ref: () => {} });
    const second = offerSlashCommands(a, { fusnota: () => {} });
    expect(slashCommandsOf(b)).toEqual({});
    first();
    expect(Object.keys(slashCommandsOf(a))).toEqual(["fusnota"]);
    second();
    expect(slashCommandsOf(a)).toEqual({});
  });
});
