// @vitest-environment jsdom
// Otisak verzije u gornjoj traci nastavnika: stanja oznake i ponovna provjera klikom, uz zamjensku provjeru.
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { LiveDocument } from "@/client/live-publisher";
import Fingerprint from "./Fingerprint";
import type { FingerprintState, RecordedFingerprint } from "./fingerprint-check";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const DOC = { schemaVersion: 1, nodes: [] } as unknown as LiveDocument;
const SHA = "d".repeat(64);
const RECORDED: RecordedFingerprint = { sha256: SHA, revision: 9 };

let root: Root | null = null;
let host: HTMLElement | null = null;

afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  root = null; host = null;
});

function deferred() {
  let resolve!: (state: FingerprintState) => void;
  const promise = new Promise<FingerprintState>((done) => { resolve = done; });
  return { promise, resolve };
}

async function show(check: (doc: LiveDocument, recorded: RecordedFingerprint) => Promise<FingerprintState>) {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () => { root!.render(h(Fingerprint, { document: DOC, recorded: RECORDED, check, minMs: 0 })); });
}
const mark = () => host!.querySelector("button")!;

describe("Fingerprint", () => {
  it("sivo „Provjeravam otisak…” s kružićem dok se računa, zatim zeleno s verzijom i bez ispisanog SHA", async () => {
    const pending = deferred();
    await show(() => pending.promise);
    expect(mark().dataset.s).toBe("checking");
    expect(mark().textContent).toBe("Provjeravam otisak…");
    expect(mark().querySelector("i")).not.toBeNull();
    await act(async () => { pending.resolve({ kind: "match", revision: 9, recorded: SHA, shown: SHA }); await new Promise((r) => setTimeout(r, 0)); });
    expect(mark().dataset.s).toBe("match");
    expect(mark().querySelector("b")!.textContent).toBe("Otisak se podudara");
    expect(mark().querySelector("small")!.textContent).toBe("verzija 9");
    expect(mark().querySelector("i")).toBeNull();
    expect(mark().textContent).not.toContain(SHA);
    expect(mark().title).toContain(SHA);
  });

  it("klik provjerava ponovno; crveno kad se otisak ne podudara", async () => {
    const check = vi.fn(async (): Promise<FingerprintState> => ({ kind: "match", revision: 9, recorded: SHA, shown: SHA }));
    await show(check);
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
    expect(check).toHaveBeenCalledTimes(1);
    check.mockResolvedValueOnce({ kind: "mismatch", revision: 9, recorded: SHA, shown: "e".repeat(64) });
    await act(async () => { mark().click(); await new Promise((r) => setTimeout(r, 0)); });
    expect(check).toHaveBeenCalledTimes(2);
    expect(mark().dataset.s).toBe("mismatch");
    expect(mark().querySelector("b")!.textContent).toBe("Otisak se ne podudara");
  });

  it("provjera koja ne uspije nikad ne pokazuje podudaranje", async () => {
    await show(async () => { throw new Error("izmišljeni kvar"); });
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
    expect(mark().dataset.s).toBe("unavailable");
    expect(mark().textContent).toBe("Otisak nije moguće provjeriti");
  });
});
