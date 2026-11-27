// @vitest-environment jsdom
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { fakeDirectEditPort } from "../../student/direct-edit-setting/fake-port";
import TeacherDirectEdit from "./TeacherDirectEdit";
import { directEditMessages as text } from "./messages.hr";
import type { TeacherEditPort } from "./model";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function port(enabled: boolean) {
  const submits: string[] = [];
  const p: TeacherEditPort = {
    ...fakeDirectEditPort(enabled),
    submitEdit: async (_id, body) => { submits.push(body); return { kind: "saved", text: body }; },
  };
  return { p, submits };
}

describe("TeacherDirectEdit sklop (PM2-R04)", () => {
  let root: Root | undefined;
  afterEach(() => { act(() => root?.unmount()); document.body.innerHTML = ""; });
  const mount = async (p: TeacherEditPort, writable?: boolean) => {
    const host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    await act(async () => { root?.render(h(TeacherDirectEdit, { assignmentId: "doc-demo-1", port: p, segments: [], writable })); });
    return host;
  };

  it("student ga nije dopustio: polja nema", async () => {
    const host = await mount(port(false).p);
    expect(host.querySelector("textarea")).toBeNull();
    expect(host.textContent).toContain(text.locked);
  });
  it("dopušteno i s rutom: polje postoji", async () => {
    const host = await mount(port(true).p);
    expect(host.querySelector("textarea")).not.toBeNull();
  });
  it("dopušteno, a ruta za pisanje ne postoji: polja nema i to piše", async () => {
    const { p, submits } = port(true);
    const host = await mount(p, false);
    expect(host.querySelector("textarea")).toBeNull();
    expect(host.textContent).toContain(text.noRoute);
    expect(submits).toEqual([]);
  });
  it("je montirana na stranicu nastavnikova rada", () => {
    const pages = readFileSync(join(import.meta.dirname, "../work/pages.tsx"), "utf8");
    expect(pages).toMatch(/<TeacherDirectEdit\b/);
  });
});
