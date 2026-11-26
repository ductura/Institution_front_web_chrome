// @vitest-environment jsdom
// F4-MEN-R02: the mentor reads and sends the messages beside a work on N-16 (work.messages.get/post).
// Every id, name and text is invented.
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { workMessagesHr as m } from "../../../../../../src/components/editor/mentor/messages/messages.hr";
import { WorkPlan } from "./WorkPlan";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const ORIGIN = "https://ductura.example.invalid";
const DOC = "00000000-0000-4000-8000-00000000f201";
const STUDENT_SAID = { id: "00000000-0000-4000-8000-00000000f301", senderRole: "student", text: "Izmišljeno pitanje o uvodu.", createdAt: "2026-11-24T09:00:00.000Z" };

type Seen = { method: string; path: string; body: unknown };

function serve(post: { status: number; body?: unknown }) {
  const seen: Seen[] = [];
  const json = (status: number, body?: unknown) => new Response(body === undefined ? null : JSON.stringify(body), {
    status, headers: body === undefined ? {} : { "content-type": "application/json" },
  });
  vi.stubGlobal("location", { origin: ORIGIN, href: `${ORIGIN}/app/web/nastavnik/mentorstva` });
  vi.stubGlobal("fetch", async (url: string | URL | Request, init?: RequestInit) => {
    const path = new URL(String(url), ORIGIN).pathname;
    const method = init?.method ?? "GET";
    if (path !== `/api/v1/works/${DOC}/messages`) return json(503, { error: "unavailable", code: "unavailable" });
    seen.push({ method, path, body: init?.body ? JSON.parse(String(init.body)) as unknown : undefined });
    if (method === "GET") return json(200, { messages: [STUDENT_SAID] });
    return json(post.status, post.body);
  });
  return seen;
}

let root: Root | null = null;
async function mount() {
  const host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () => {
    root!.render(h(WorkPlan, { documentId: DOC, name: "Lana Izmišljena", title: "Izmišljeni rad", base: "web", onSignedOut: () => {}, records: async () => [] }));
  });
  for (let i = 0; i < 5; i += 1) await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
  return host;
}

async function send(host: HTMLElement, text: string) {
  const area = host.querySelector(`textarea`) as HTMLTextAreaElement;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(area, text);
    area.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await act(async () => { area.form!.requestSubmit(); });
  for (let i = 0; i < 5; i += 1) await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
}

afterEach(() => {
  act(() => root?.unmount());
  root = null;
  document.body.innerHTML = "";
  vi.unstubAllGlobals();
});

describe("WorkPlan messages (F4-MEN-R02)", () => {
  it("shows the student's message and the mentor's reply only after the server keeps it", async () => {
    const reply = { id: "00000000-0000-4000-8000-00000000f302", senderRole: "teacher", text: "Izmišljeni odgovor.", createdAt: "2026-11-24T10:00:00.000Z" };
    const seen = serve({ status: 201, body: reply });
    const host = await mount();
    expect(host.textContent).toContain(m.count.replace("{total}", "1"));
    expect(host.textContent).toContain("Izmišljeno pitanje o uvodu.");
    expect(host.textContent).toContain(m.sender.student);
    expect(host.querySelector("textarea")?.labels?.[0]?.textContent).toContain(m.label.teacher);
    await send(host, "  Izmišljeni odgovor.  ");
    expect(seen.filter((s) => s.method === "POST")).toEqual([{ method: "POST", path: `/api/v1/works/${DOC}/messages`, body: { text: "Izmišljeni odgovor." } }]);
    expect(host.textContent).toContain(m.sender.teacher);
    expect(host.textContent).toContain(m.count.replace("{total}", "2"));
  });

  it("a refused or unknown answer keeps the draft and adds nothing", async () => {
    const seen = serve({ status: 503, body: { error: "unavailable", code: "unavailable" } });
    const host = await mount();
    await send(host, "Izmišljeni odgovor.");
    expect(seen.filter((s) => s.method === "POST")).toHaveLength(1);
    expect(host.textContent).toContain(m.failed);
    expect(host.textContent).toContain(m.count.replace("{total}", "1"));
    expect((host.querySelector("textarea") as HTMLTextAreaElement).value).toBe("Izmišljeni odgovor.");
  });

  it("a blank message is not sent", async () => {
    const seen = serve({ status: 201 });
    const host = await mount();
    await send(host, "   ");
    expect(host.textContent).toContain(m.blank);
    expect(seen.filter((s) => s.method === "POST")).toEqual([]);
  });
});
