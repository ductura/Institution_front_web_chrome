// @vitest-environment jsdom
// WEB-V14-SHEET-EXPORT: the two buttons as a student drives them. The transport is a recorded one; the bytes are invented.
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

const downloads: { name: string; type: string }[] = [];
vi.mock("../../../../../../src/components/editor/EarlierDraft", () => ({
  downloadBlob: (blob: Blob, name: string) => { downloads.push({ name, type: blob.type }); },
}));
vi.mock("../../context", () => ({ useHost: () => ({ base: "/" }) }));
const signIn = vi.fn();
vi.mock("../../../../../../src/client/api", async (orig) => ({ ...(await orig<object>()), goToSignIn: (...a: unknown[]) => signIn(...a) }));

import SheetExport from "./SheetExport";
import { CSV_MIME, XLSX_MIME } from "./port";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root | undefined;
afterEach(() => { act(() => root?.unmount()); root = undefined; document.body.innerHTML = ""; downloads.length = 0; signIn.mockReset(); });

const ok = (type: string, bytes: number[]) => (async () => new Response(new Uint8Array(bytes), { status: 200, headers: { "content-type": type } })) as unknown as typeof fetch;
const status = (s: number) => (async () => new Response(null, { status: s })) as unknown as typeof fetch;
const mount = async (transport: typeof fetch, online = () => true) => {
  const host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () => { root?.render(h(SheetExport, { documentId: "d1", title: "Proračun", here: "/rad/a1", transport, online })); });
};
const button = (text: string) => [...document.querySelectorAll("button")].find((b) => b.textContent === text)!;
const click = async (text: string) => {
  await act(async () => {
    button(text).click();
    // The answer is read and hashed asynchronously: wait until the screen has left "loading".
    for (let i = 0; i < 100 && (document.querySelector('[role="status"]')?.textContent ?? "").startsWith("Pripremam"); i += 1) await new Promise((r) => setTimeout(r, 5));
    await new Promise((r) => setTimeout(r, 20));
  });
};

describe("SheetExport", () => {
  it("downloads the CSV under the title and says so", async () => {
    await mount(ok(CSV_MIME, [65, 59, 66]));
    await click("Izvezi CSV");
    expect(downloads).toEqual([{ name: "Proračun.csv", type: CSV_MIME }]);
    expect(document.querySelector('[role="status"]')?.textContent).toBe("CSV je preuzet.");
  });
  it("downloads the .xlsx", async () => {
    await mount(ok(XLSX_MIME, [0x50, 0x4b, 3, 4]));
    await click("Izvezi .xlsx");
    expect(downloads).toEqual([{ name: "Proračun.xlsx", type: XLSX_MIME }]);
  });
  it("shows an error and downloads nothing when the work is not found, and offers a retry", async () => {
    await mount(status(404));
    await click("Izvezi CSV");
    expect(downloads).toEqual([]);
    expect(document.querySelector('[role="alert"]')?.textContent).toContain("Rad nije pronađen");
    expect(button("Pokušaj ponovno")).toBeTruthy();
  });
  it("shows the unavailable line for 503 and for a wrong file", async () => {
    await mount(status(503));
    await click("Izvezi .xlsx");
    expect(document.querySelector('[role="alert"]')?.textContent).toContain("trenutačno nije dostupan");
    act(() => root?.unmount());
    await mount(ok(XLSX_MIME, [1, 2, 3]));
    await click("Izvezi .xlsx");
    expect(downloads).toEqual([]);
    expect(document.querySelector('[role="alert"]')?.textContent).toContain("nije vratio očekivanu datoteku");
  });
  it("sends a signed-out student to sign in, with no file and no error line", async () => {
    await mount(status(401));
    await click("Izvezi CSV");
    expect(signIn).toHaveBeenCalledTimes(1);
    expect(downloads).toEqual([]);
  });
  it("makes no request while offline and says so", async () => {
    const transport = vi.fn();
    await mount(transport as unknown as typeof fetch, () => false);
    await click("Izvezi CSV");
    expect(transport).not.toHaveBeenCalled();
    expect(document.querySelector('[role="alert"]')?.textContent).toContain("Niste na mreži");
  });
  it("tells that the export holds the saved state and the first sheet", async () => {
    await mount(status(404));
    expect(document.body.textContent).toContain("prvi list");
    expect(document.body.textContent).toContain("spremljeno na poslužitelju");
  });
});
