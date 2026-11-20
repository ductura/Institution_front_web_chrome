import { describe, expect, it } from "vitest";

import { findForbiddenTerms } from "../../../../scripts/forbidden-terms/terms";
import { editorHelpHr } from "../../../lib/i18n/messages.hr";
import { defaultHelp, forLevel, levelOf, readHelp, toggleWarning, warningKeys } from "./preferences";

describe("writing help preferences", () => {
  it("keeps the Croatian help copy clear of forbidden UI terms", () => {
    expect(findForbiddenTerms(JSON.stringify(editorHelpHr), "hr")).toEqual([]);
  });

  it("applies the prototype presets and recognises them after manual changes", () => {
    expect(forLevel("calm", [])).toEqual(["cmt"]);
    expect(forLevel("all", [])).toEqual(warningKeys);
    const custom = toggleWarning(defaultHelp.enabled, "claim");
    expect(levelOf(custom)).toBe("custom");
    expect(levelOf(toggleWarning(custom, "claim"))).toBe("basic");
    expect(forLevel("custom", custom)).toBe(custom);
  });

  it("restores an explicit custom level, including one matching a preset", () => {
    const stored = { ...defaultHelp, level: "custom" };
    expect(readHelp(() => JSON.stringify(stored))).toEqual(stored);
    expect(readHelp(() => '{"enabled":["cmt","cmt"]}')).toEqual({ enabled: ["cmt"], level: "calm" });
  });

  it("uses the basic preset with corrupt or blocked storage", () => {
    for (const read of [() => null, () => "{", () => '{"enabled":["unknown"]}', () => { throw new Error(); }]) {
      expect(readHelp(read)).toEqual(defaultHelp);
    }
    expect(readHelp(() => '{"enabled":[]}')).toEqual({ enabled: [], level: "custom" });
  });
});
