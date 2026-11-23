// @vitest-environment jsdom
// PIL-D3-NASTAVNIK: the history and the switch mounted beside the submissions table. Fake servers,
// invented data.
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";

import { fakeSubmissionsPort } from "../fake-port";
import TeacherSubmissions from "../TeacherSubmissions";
import { ASSIGNMENT, fakeHistoryServer, STUDENT } from "./fake-port";
import { historyMountText, historyText } from "./messages.hr";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("TeacherSubmissions with the history", () => {
  let root: Root | undefined;
  let host: HTMLElement;
  afterEach(() => { act(() => root?.unmount()); root = undefined; document.body.innerHTML = ""; });

  const mount = async (props: Record<string, unknown>) => {
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    await act(async () => { root?.render(h(TeacherSubmissions, { port: fakeSubmissionsPort(), assignmentId: ASSIGNMENT, ...props })); });
    await act(async () => { await Promise.resolve(); });
  };
  const box = () => host.querySelector<HTMLInputElement>("input[type='checkbox']");

  it("shows the switch as the server holds it and saves a change on the server", async () => {
    const server = fakeHistoryServer();
    await mount({ history: server.call });
    expect(host.textContent).toContain(historyText.settingLabel);
    expect(box()?.checked).toBe(true);
    await act(async () => { box()?.click(); });
    await act(async () => { await Promise.resolve(); });
    expect(server.enabled()).toBe(false);
    expect(box()?.checked).toBe(false);
    expect(host.textContent).toContain(historyText.settingSaved);
  });

  it("opens one student's history with every version and the withdrawal, which stays in it", async () => {
    await mount({ history: fakeHistoryServer().call });
    const open = host.querySelector<HTMLButtonElement>(`button[aria-label='${historyMountText.openFor(STUDENT)}']`);
    expect(open).not.toBeNull();
    await act(async () => { open?.click(); });
    await act(async () => { await Promise.resolve(); });
    const text = host.textContent ?? "";
    expect(text).toContain(historyText.title);
    expect(text).toContain(historyText.withdrawn);
    expect(text).toContain(`${historyText.submitted} ${historyText.afterDeadline}`);
    expect(host.querySelectorAll("section[aria-label] tbody tr")).toHaveLength(3);
  });

  it("without the history port the screen is as before", async () => {
    await mount({});
    expect(box()).toBeNull();
    expect(host.textContent).not.toContain(historyMountText.column);
  });
});
