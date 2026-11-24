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

// ED-01c (NF2-P2): the product bar's chip is calm; only its own region speaks.
describe("StatusBarLive in the product editor", () => {
  it("renders the chip without a live region and keeps one empty region for level changes", () => {
    read.receiptVerified = true;
    const html = renderToStaticMarkup(<StatusBarLive evidence online />);
    expect(html.match(/role="status"/g)).toHaveLength(1);
    expect(html).toContain('role="status"></span>');
    expect(html).toContain(SAVE_STATES.SYNCED.label);
  });

  it("offline, says how many changes wait next to Izvan mreže", () => {
    // Changes wait, so no receipt covers them yet.
    read.receiptVerified = false;
    const html = renderToStaticMarkup(<StatusBarLive evidence online={false} pending={3} />);
    expect(html).toContain("Izvan mreže · Spremljeno na uređaju · čeka slanje: 3 izmjene");
    const none = renderToStaticMarkup(<StatusBarLive evidence online={false} pending={0} />);
    expect(none).not.toContain("čeka slanje");
  });

  it("keeps the older bar a live chip when no network state is given", () => {
    const html = renderToStaticMarkup(<StatusBarLive evidence />);
    expect(html.match(/role="status"/g)).toHaveLength(1);
    expect(html).not.toContain('role="status"></span>');
  });
});
