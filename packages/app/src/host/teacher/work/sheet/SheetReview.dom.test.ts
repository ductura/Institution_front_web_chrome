// @vitest-environment jsdom
// WEB-V14-SHEET-SUBMIT: the teacher's branch by kind in jsdom with a recorded read. Invented cells only.
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createSheetDocument } from "../../../../../../editor-core/src/sheet/index.ts";
import type { SheetRead } from "./read.ts";

const signIn = vi.hoisted(() => vi.fn());
vi.mock("../../../context", () => ({ useHost: () => ({ base: "/app/web" }) }));
vi.mock("../../../../../../../src/client/api.ts", () => ({ goToSignIn: signIn, createApi: () => vi.fn(), SERVER_PREFIX: "/api/v1/", browserTransport: vi.fn() }));
const { SheetOrWork } = await import("./SheetReview.tsx");

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const doc = () => { const d = createSheetDocument({ id: "s1", name: "List1" }); d.sheets[0]!.cells = { A1: { value: "Uvod" } }; return d; };

describe("SheetOrWork", () => {
  let root: Root;
  let host: HTMLDivElement;
  beforeEach(() => { signIn.mockReset(); host = document.createElement("div"); document.body.append(host); root = createRoot(host); });
  afterEach(() => { act(() => root.unmount()); document.body.innerHTML = ""; });
  const mount = async (read: () => Promise<SheetRead>) => {
    await act(async () => { root.render(h(SheetOrWork, { documentId: "doc-1", path: "/nastavnik/rad/doc-1", fallback: h("p", null, "TEKSTNA STRANICA"), read })); });
  };

  it("keeps the existing page for another kind, somebody else's work (404) and 401 (which shows its own state)", async () => {
    for (const kind of ["text", "notFound", "signedOut"] as const) { await mount(async () => ({ kind })); expect(host.textContent).toBe("TEKSTNA STRANICA"); }
    expect(signIn).toHaveBeenCalled();
  });
  it("does not hold another work back while the kind is still being read", async () => {
    await mount((() => new Promise(() => {})) as never);
    expect(host.textContent).toBe("TEKSTNA STRANICA");
  });
  it("opens the grid read only for a spreadsheet work", async () => {
    await mount(async () => ({ kind: "sheet", revision: 3, document: doc() }));
    expect(host.textContent).toContain("Tablica se samo čita.");
    expect(host.textContent).toContain("Prikazana revizija: 3");
    expect(host.textContent).toContain("Uvod");
    expect(host.querySelector("[aria-readonly=true]")).not.toBeNull();
    expect(host.textContent).not.toContain("TEKSTNA STRANICA");
  });
  it("a failed or invalid read is an error screen, never an empty sheet and never the text page", async () => {
    for (const kind of ["unavailable", "invalid"] as const) {
      await mount(async () => ({ kind }));
      expect(host.textContent).toContain("Tablica nije dostupna");
      expect(host.textContent).not.toContain("TEKSTNA STRANICA");
    }
  });
});
