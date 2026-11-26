// @vitest-environment jsdom
// P-B1 / R-17: after every change of state that shows the form again, the code field has the focus. Invented data only.
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { enroll } = vi.hoisted(() => ({ enroll: vi.fn() }));
vi.mock("./enroll.ts", () => ({ enroll }));

import EnrolForm from "./EnrolForm";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.clearAllMocks();
});

const input = () => host.querySelector("input") as HTMLInputElement;
async function submitCode(value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
  await act(async () => {
    setter.call(input(), value);
    input().dispatchEvent(new Event("input", { bubbles: true }));
  });
  await act(async () => {
    host.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
}

describe("R-17 focus in the code field", () => {
  it("takes the focus on arrival and again after a refusal", async () => {
    enroll.mockResolvedValue({ kind: "invalidCode" });
    await act(async () => root.render(createElement(EnrolForm, { signInHref: "/prijava", navigate: () => {} })));
    expect(document.activeElement).toBe(input());
    input().blur();
    await submitCode("ABCD1234");
    expect(host.textContent).toContain("Kod ne postoji ili je istekao.");
    expect(document.activeElement).toBe(input());
  });

  it("takes the focus back after \"Upiši drugi kolegij\"", async () => {
    enroll.mockResolvedValue({ kind: "noAssignment", courseId: "c1" });
    await act(async () => root.render(createElement(EnrolForm, { signInHref: "/prijava", navigate: () => {} })));
    await submitCode("ABCD1234");
    expect(host.querySelector("input")).toBeNull();
    await act(async () => { (host.querySelector("a") as HTMLAnchorElement).click(); });
    expect(document.activeElement).toBe(input());
  });
});
