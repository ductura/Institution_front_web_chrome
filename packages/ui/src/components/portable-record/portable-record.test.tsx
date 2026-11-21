// @vitest-environment jsdom
import axe from "axe-core";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PortableRecordCard, type PortableRecordLabels, type PortableRecordState } from "./PortableRecordCard";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const labels: PortableRecordLabels = {
  title: "Prenosivi zapis",
  contentsLead: "Zapis sadrži:",
  contents: ["potvrdu predaje", "dnevni korijen", "dokaz", "PDF s QR kodom"],
  howToLead: "Zapis možete provjeriti:",
  howTo: ["na svom računalu, naredbom u terminalu", "QR kodom na javnoj stranici Provjera"],
  download: "Preuzmi zapis",
  downloading: "Preuzimanje…",
};

describe("PortableRecordCard states", () => {
  it("ready: what the record holds, how to check it and an enabled button", () => {
    const html = renderToStaticMarkup(<PortableRecordCard state={{ kind: "ready" }} labels={labels} onDownload={() => {}} />);
    expect(html).toContain('data-state="ready"');
    for (const line of [...labels.contents, ...labels.howTo]) expect(html).toContain(line);
    expect(html).toContain("Preuzmi zapis");
    expect(html).not.toContain("aria-disabled");
    expect(html).not.toContain('role="alert"');
  });

  it("downloading: the button is busy and says so", () => {
    const html = renderToStaticMarkup(<PortableRecordCard state={{ kind: "downloading" }} labels={labels} onDownload={() => {}} />);
    expect(html).toContain('data-state="downloading"');
    expect(html).toContain('aria-disabled="true"');
    expect(html).toContain("Preuzimanje…");
  });

  it("error: the message is an alert and the button stays for another try", () => {
    const html = renderToStaticMarkup(<PortableRecordCard state={{ kind: "error", message: "Zapis nije dostupan." }} labels={labels} onDownload={() => {}} />);
    expect(html).toContain('role="alert"');
    expect(html).toContain("Zapis nije dostupan.");
    expect(html).toContain("Preuzmi zapis");
    expect(html).not.toContain("aria-disabled");
  });

  it("shows no number and no grade", () => {
    const html = renderToStaticMarkup(<PortableRecordCard state={{ kind: "ready" }} labels={labels} onDownload={() => {}} />);
    expect(html.replace(/<[^>]*>/g, "")).not.toMatch(/\d/);
  });
});

describe("PortableRecordCard behaviour and accessibility", () => {
  let root: Root | undefined;
  afterEach(() => { act(() => root?.unmount()); document.body.innerHTML = ""; });
  const mount = (state: PortableRecordState, onDownload = () => {}) => {
    const host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    act(() => root?.render(<PortableRecordCard state={state} labels={labels} onDownload={onDownload} />));
    return host;
  };

  it("the button asks to download once per click, and not while busy", () => {
    const onDownload = vi.fn();
    mount({ kind: "ready" }, onDownload).querySelector("button")?.click();
    expect(onDownload).toHaveBeenCalledTimes(1);
    act(() => root?.unmount());
    const busy = vi.fn();
    mount({ kind: "downloading" }, busy).querySelector("button")?.click();
    expect(busy).not.toHaveBeenCalled();
  });

  it.each([{ kind: "ready" }, { kind: "downloading" }, { kind: "error", message: "Zapis nije dostupan." }] as const)("%o has no axe violation", async (state) => {
    const host = mount(state);
    const result = await axe.run(host, { rules: { "color-contrast": { enabled: false }, region: { enabled: false } } });
    expect(result.violations).toEqual([]);
  });
});
