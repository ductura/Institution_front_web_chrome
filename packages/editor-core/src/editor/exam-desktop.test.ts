// @vitest-environment node
import { Editor } from "@tiptap/core";
import { describe, expect, it } from "vitest";

import { connectExamToDesktop, desktopWebView, type DesktopWebView } from "./exam-desktop";
import { createExamMode, type ExamRefusal } from "./exam-mode";
import { createEditorExtensions } from "./schema";
import { SourceObserver } from "./source";

/** An invented WebView2 bridge (window.chrome.webview) that records what the page posts. */
function fakeWebView() {
  const posted: unknown[] = [];
  const listeners = new Set<(e: { data: unknown }) => void>();
  const webview: DesktopWebView = {
    postMessage: (m) => posted.push(m),
    addEventListener: (_t, h) => listeners.add(h),
    removeEventListener: (_t, h) => listeners.delete(h),
  };
  const send = (data: unknown) => listeners.forEach((h) => h({ data }));
  return { webview, posted, listeners, send };
}

describe("exam mode and the desktop app (P-4 proposal)", () => {
  it("tells the desktop app when the exam starts and ends, with the accommodation", () => {
    const f = fakeWebView();
    const stop = connectExamToDesktop({ webview: f.webview, accommodation: false, onBlocked: () => {} });
    expect(f.posted).toEqual([{ type: "ductura-exam", on: true, accommodation: false }]);
    stop();
    expect(f.posted[1]).toEqual({ type: "ductura-exam", on: false, accommodation: false });
    expect(f.listeners.size).toBe(0);
  });

  it("passes the accommodation on, so the app does not drop the on-screen keyboard or dictation", () => {
    const f = fakeWebView();
    connectExamToDesktop({ webview: f.webview, accommodation: true, onBlocked: () => {} });
    expect(f.posted[0]).toEqual({ type: "ductura-exam", on: true, accommodation: true });
  });

  it("reports only new keys the app dropped", () => {
    const f = fakeWebView();
    const seen: number[] = [];
    connectExamToDesktop({ webview: f.webview, accommodation: false, onBlocked: (n) => seen.push(n) });
    f.send({ type: "ductura-keys-blocked", count: 3 });
    f.send({ type: "ductura-keys-blocked", count: 3 });
    f.send({ type: "ductura-keys-blocked", count: 5 });
    expect(seen).toEqual([3, 2]);
  });

  it("ignores other and malformed messages", () => {
    const f = fakeWebView();
    const seen: number[] = [];
    connectExamToDesktop({ webview: f.webview, accommodation: false, onBlocked: (n) => seen.push(n) });
    for (const data of [null, "x", { type: "other", count: 4 }, { type: "ductura-keys-blocked" },
      { type: "ductura-keys-blocked", count: "4" }, { type: "ductura-keys-blocked", count: -1 },
      { type: "ductura-keys-blocked", count: 1.5 }, { type: "ductura-keys-blocked", count: Infinity }]) f.send(data);
    expect(seen).toEqual([]);
  });

  it("is off outside the desktop app", () => {
    expect(desktopWebView({})).toBeNull();
    expect(desktopWebView({ chrome: {} })).toBeNull();
    const f = fakeWebView();
    expect(desktopWebView({ chrome: { webview: f.webview } })).toBe(f.webview);
  });

  it("stops twice without telling the app twice", () => {
    const f = fakeWebView();
    const stop = connectExamToDesktop({ webview: f.webview, accommodation: false, onBlocked: () => {} });
    stop();
    stop();
    expect(f.posted).toHaveLength(2);
  });

  it("exam mode in the editor turns the app's exam mode on and off, and says why keys did not appear", async () => {
    const f = fakeWebView();
    const refusals: ExamRefusal[] = [];
    const observer = new SourceObserver();
    const editor = new Editor({
      element: null,
      content: { type: "doc", content: [{ type: "paragraph" }] },
      extensions: [...createEditorExtensions(), observer.extension,
        createExamMode({ observer, desktop: f.webview, onRefused: (r) => refusals.push(r) })],
    });
    expect(f.posted).toEqual([{ type: "ductura-exam", on: true, accommodation: false }]);
    f.send({ type: "ductura-keys-blocked", count: 2 });
    await new Promise((r) => setTimeout(r, 0));
    expect(refusals).toEqual(["program"]);
    editor.destroy();
    expect(f.posted.at(-1)).toEqual({ type: "ductura-exam", on: false, accommodation: false });
  });

  it("exam mode without the desktop app posts nothing", () => {
    const observer = new SourceObserver();
    const editor = new Editor({
      element: null,
      content: { type: "doc", content: [{ type: "paragraph" }] },
      extensions: [...createEditorExtensions(), observer.extension, createExamMode({ observer, desktop: null })],
    });
    editor.destroy();
  });
});