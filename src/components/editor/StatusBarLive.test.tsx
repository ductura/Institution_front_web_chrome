import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SAVE_STATES } from "@ductura/ui";

const read = vi.hoisted(() => ({
  phase: "ready" as const,
  state: "SYNCED" as const,
  receiptVerified: false,
}));

vi.mock("./LocalDocument", () => ({
  useLocalSaveRead: () => read,
  useLocalStatus: () => ({ loading: false, words: 0 }),
}));

import StatusBarLive from "./StatusBarLive";

// INT-11: "na poslužitelju" follows the saver's own receipt check, not the state alone.
describe("StatusBarLive and the receipt check", () => {
  beforeEach(() => { read.receiptVerified = false; });

  it("shows saved on the device for SYNCED without a verified receipt", () => {
    const html = renderToStaticMarkup(<StatusBarLive evidence />);
    expect(html).not.toContain(SAVE_STATES.SYNCED.label);
    expect(html).toContain(SAVE_STATES.LOCAL_DURABLE.label);
  });

  it("shows saved on the server once the receipt was verified here", () => {
    read.receiptVerified = true;
    const html = renderToStaticMarkup(<StatusBarLive evidence />);
    expect(html).toContain(SAVE_STATES.SYNCED.label);
  });

  it("never shows saved on the server without the evidence saver", () => {
    read.receiptVerified = true;
    const html = renderToStaticMarkup(<StatusBarLive evidence={false} />);
    expect(html).not.toContain(SAVE_STATES.SYNCED.label);
  });
});
