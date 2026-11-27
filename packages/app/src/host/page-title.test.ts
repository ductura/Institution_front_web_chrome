// WEB-NASLOVI-SVE: a page's own tab title ("<naziv rada> — Pisanje") reaches the host and goes with the page.
// @vitest-environment jsdom
import { createElement, act, useState } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";

import { hostText } from "../text";
import { PageTitleContext, headingFor, usePageTitle, workTitle } from "./page-title";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("workTitle", () => {
  it("joins the work's name and the part with a dash", () => {
    expect(workTitle("Seminar o šumama", hostText.titleWriting)).toBe("Seminar o šumama — Pisanje");
    expect(workTitle("Seminar o šumama", hostText.titleSubmission)).toBe("Seminar o šumama — Predaja");
  });
  it("is null until the name is read (the route's label stays)", () => {
    expect(workTitle(null, "Pisanje")).toBeNull();
    expect(workTitle("  ", "Pisanje")).toBeNull();
  });
});

describe("headingFor", () => {
  it("leaves the public home page with the app's name alone, and every other page with its label", () => {
    expect(headingFor("/naslovnica", "Ductura, početna")).toBeNull();
    expect(headingFor("/zadaci", "Moji zadaci")).toBe("Moji zadaci");
    expect(headingFor(null, null)).toBeNull();
  });
});

describe("usePageTitle", () => {
  it("sets the detail while the page is shown and clears it when the page goes", async () => {
    const seen: (string | null)[] = [];
    function Page() {
      usePageTitle("Rad — Pisanje");
      return null;
    }
    function Host() {
      const [on, setOn] = useState(true);
      return createElement(PageTitleContext, { value: (d: string | null) => seen.push(d) },
        on ? createElement(Page) : null, createElement("button", { onClick: () => setOn(false) }));
    }
    const el = document.createElement("div");
    const root = createRoot(el);
    await act(async () => root.render(createElement(Host)));
    expect(seen).toEqual(["Rad — Pisanje"]);
    await act(async () => el.querySelector("button")!.click());
    expect(seen).toEqual(["Rad — Pisanje", null]);
    await act(async () => root.unmount());
  });
});
