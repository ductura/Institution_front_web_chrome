// @vitest-environment jsdom
// PIL-P1-RITAM-EDITOR: the host follows the editor the student writes in. With no writable
// editor (a replay, a submitted or a teacher's read-only view) it asks nothing and sends
// nothing; once the editor is writable it asks the switch of this work. The port is a fake.
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { RhythmPort } from "@/client/input-rhythm";

import { InputRhythmHost, writableEditor } from "./InputRhythmHost";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function spyPort(on: boolean) {
  const port = {
    recording: vi.fn(async () => on),
    send: vi.fn(async () => undefined),
  } satisfies RhythmPort;
  return port;
}

function editor(editable: boolean): HTMLElement {
  const el = document.createElement("div");
  el.className = "ProseMirror";
  el.setAttribute("contenteditable", String(editable));
  document.body.append(el);
  return el;
}

describe("InputRhythmHost", () => {
  let root: Root | undefined;
  afterEach(() => { act(() => root?.unmount()); root = undefined; document.body.innerHTML = ""; });

  const mount = async (port: RhythmPort) => {
    const host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    await act(async () => { root?.render(h(InputRhythmHost, { documentId: "doc-demo-1", port })); });
  };

  it("finds only a writable editor", () => {
    editor(false);
    expect(writableEditor()).toBeNull();
    const writable = editor(true);
    expect(writableEditor()).toBe(writable);
  });

  it("asks nothing and sends nothing over a read-only editor (replay, submitted, teacher)", async () => {
    editor(false);
    const port = spyPort(true);
    await mount(port);
    act(() => root?.unmount());
    root = undefined;
    expect(port.recording).not.toHaveBeenCalled();
    expect(port.send).not.toHaveBeenCalled();
  });

  it("asks the switch of this work once the editor can be written in", async () => {
    const port = spyPort(true);
    await mount(port);
    expect(port.recording).not.toHaveBeenCalled();
    await act(async () => { editor(true); });
    expect(port.recording).toHaveBeenCalledWith("doc-demo-1");
  });

  it("with the switch off, untouched writing sends nothing on leaving", async () => {
    editor(true);
    const port = spyPort(false);
    await mount(port);
    expect(port.recording).toHaveBeenCalledTimes(1);
    act(() => root?.unmount());
    root = undefined;
    expect(port.send).not.toHaveBeenCalled();
  });
});
