// @vitest-environment jsdom
// F4-EDI-R06: the dialog shows, read-only, the conversations, the transfers and the attachments of the work.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { findForbiddenTerms } from "../../../../../scripts/forbidden-terms/terms";
import { createFakeRhythmPort } from "../../../../client/input-rhythm-fake";
import type { RecordedPort } from "../../../../client/recorded-overview";
import { whatIsRecordedHr } from "../../../../lib/i18n/messages.hr";
import { WhatIsRecorded } from "./WhatIsRecorded";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
afterEach(() => {
  act(() => root?.unmount());
  root = null;
  document.body.innerHTML = "";
});

async function render(node: React.ReactNode): Promise<HTMLElement> {
  const el = document.createElement("div");
  document.body.append(el);
  root = createRoot(el);
  await act(async () => { root!.render(node); });
  return el;
}

const READY: RecordedPort = {
  transfers: vi.fn(async () => ({ kind: "ready", value: [
    { kind: "imported_file", percent: 12.4 }, { kind: "pasted_known", percent: 3 }, { kind: "pasted_unknown", percent: 0 },
  ] } as const)),
  conversations: vi.fn(async () => ({ kind: "ready", value: { conversations: 2, requests: 5, lastActivityAt: "2026-11-20T10:00:00.000Z" } } as const)),
};

describe("what is recorded: read-only overview", () => {
  it("shows conversations, transfers and an honest attachments line", async () => {
    const el = await render(<WhatIsRecorded documentId="rad-1" assignmentId="zadatak-1" port={createFakeRhythmPort()} recorded={READY} />);
    expect(READY.conversations).toHaveBeenCalledWith("zadatak-1");
    expect(READY.transfers).toHaveBeenCalledWith("rad-1");
    expect(el.querySelector("[data-testid=recorded-conversations]")?.textContent).toContain("Razgovora: 2, upita: 5.");
    expect(el.querySelector("[data-testid=recorded-conversations]")?.textContent).toContain("20. 11. 2026");
    const list = el.querySelector("[data-testid=recorded-transfers]")!.textContent!;
    expect(list).toContain("Uvezeno iz datoteke: 12 %");
    expect(list).toContain("Zalijepljeno, bez objašnjenja: 0 %");
    expect(el.querySelector("[data-testid=recorded-attachments]")?.textContent).toBe(whatIsRecordedHr.recorded.attachments.unavailable);
    expect(el.querySelectorAll("button, input, select, textarea").length).toBe(el.querySelectorAll("[data-testid=rhythm-setting] button, [data-testid=rhythm-setting] input").length);
  });

  it("says a failed read as unavailable, never as an empty list", async () => {
    const failing: RecordedPort = {
      transfers: vi.fn(async () => ({ kind: "unavailable" } as const)),
      conversations: vi.fn(async () => ({ kind: "signedOut" } as const)),
    };
    const el = await render(<WhatIsRecorded documentId="rad-1" assignmentId="zadatak-1" port={createFakeRhythmPort()} recorded={failing} />);
    expect(el.querySelector("[data-testid=recorded-transfers]")).toBeNull();
    expect(el.querySelector("[data-testid=recorded-transfers-state]")?.textContent).toBe(whatIsRecordedHr.recorded.unavailable);
    expect(el.querySelector("[data-testid=recorded-conversations-none]")).toBeNull();
    expect(el.querySelector("[data-testid=recorded-conversations-state]")?.textContent).toBe(whatIsRecordedHr.recorded.signedOut);
  });

  it("does not read the conversations without an assignment, and says so", async () => {
    const port: RecordedPort = { transfers: READY.transfers, conversations: vi.fn(async () => ({ kind: "unavailable" } as const)) };
    const el = await render(<WhatIsRecorded documentId="rad-1" port={createFakeRhythmPort()} recorded={port} />);
    expect(port.conversations).not.toHaveBeenCalled();
    expect(el.querySelector("[data-testid=recorded-conversations-unknown]")).not.toBeNull();
  });

  it("says no conversation as such and keeps the wording clear of forbidden terms", async () => {
    const none: RecordedPort = { ...READY, conversations: vi.fn(async () => ({ kind: "ready", value: { conversations: 0, requests: 0, lastActivityAt: null } } as const)) };
    const el = await render(<WhatIsRecorded documentId="rad-1" assignmentId="zadatak-1" port={createFakeRhythmPort()} recorded={none} />);
    expect(el.querySelector("[data-testid=recorded-conversations-none]")?.textContent).toBe("Nema razgovora.");
    expect(findForbiddenTerms(JSON.stringify(whatIsRecordedHr.recorded), "hr")).toEqual([]);
  });
});
