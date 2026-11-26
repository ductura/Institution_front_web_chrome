// @vitest-environment jsdom
// MEN-26 ("Priloži pripremu"): the student attaches the composed preparation to a consultation request.
// The answers are fake, in the shape of work.consultation-slot-requests.post; all data is invented.
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";

import { createApi } from "../../../../../../../src/client/api";
import type { PrepInput } from "../../mentor/mentor-model";

import { ConsultSlots } from "./ConsultSlots";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const DOC = "izmisljeni-rad-0002";
const NEW = "2d8b3e4a-6c7f-4a01-9c3d-4e5f6a7b8c9d";
const INPUT: PrepInput = { since: "2026-11-10", changed: 3, resolved: 2, agreed: [], openComments: 1, words: null, toReview: null };
type Call = [string, unknown];

function server(calls: Call[], failPost = false) {
  return createApi({
    baseUrl: "https://ductura.example.invalid",
    fetchImpl: async (input, init) => {
      const path = new URL(String(input)).pathname;
      const method = init?.method ?? "GET";
      const body = init?.body ? JSON.parse(String(init.body)) : undefined;
      if (method === "GET") return new Response(JSON.stringify({ slots: [] }), { status: 200, headers: { "content-type": "application/json" } });
      calls.push([path, body]);
      if (failPost) return new Response(JSON.stringify({ code: "unavailable" }), { status: 503, headers: { "content-type": "application/json" } });
      const slot = { id: NEW, startsAt: body.startsAt, proposedAt: "2026-11-20T11:00:00.000Z", state: "requested", topic: body.topic ?? null, closing: null, preparation: body.preparation ?? null };
      return new Response(JSON.stringify(slot), { status: 201, headers: { "content-type": "application/json" } });
    },
  });
}

describe("ConsultSlots: Priloži pripremu", () => {
  let root: Root | undefined;
  let host: HTMLElement;
  afterEach(() => { act(() => root?.unmount()); root = undefined; document.body.innerHTML = ""; });

  const mount = async (call: ReturnType<typeof server>, compose: (() => Promise<PrepInput | null>) | undefined, role: "student" | "teacher" = "student") => {
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    await act(async () => { root?.render(h(ConsultSlots, { documentId: DOC, role, call, composePreparation: compose })); });
  };
  const click = async (el: Element | null | undefined) => { await act(async () => { (el as HTMLElement).click(); }); };
  const button = (label: string) => [...host.querySelectorAll("button")].find((b) => b.textContent === label);
  const type = async (el: HTMLInputElement | HTMLTextAreaElement, value: string) => {
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    await act(async () => { Object.getOwnPropertyDescriptor(proto, "value")!.set!.call(el, value); el.dispatchEvent(new Event("input", { bubbles: true })); });
  };
  const open = async () => {
    await click(button("Zatraži konzultacije"));
    await type(host.querySelector('input[type="datetime-local"]') as HTMLInputElement, "2026-12-01T10:00");
  };
  const checkbox = () => host.querySelector('input[type="checkbox"]') as HTMLInputElement;

  it("sends the edited preparation with both counts through the requests route, and the list shows it", async () => {
    const calls: Call[] = [];
    await mount(server(calls), async () => INPUT);
    await open();
    await click(checkbox());
    const area = host.querySelector("textarea") as HTMLTextAreaElement;
    expect(area.value).toContain("Priprema");
    expect(host.textContent).toContain("Izmijenjenih odlomaka: 3 · riješenih komentara: 2");
    await type(area, "Moja izmijenjena priprema.");
    await click(button("Pošalji mentoru"));
    expect(calls).toHaveLength(1);
    expect(calls[0]![0]).toBe(`/api/v1/works/${DOC}/consultation-slot-requests`);
    expect(calls[0]![1]).toMatchObject({ preparation: { text: "Moja izmijenjena priprema.", changedParagraphs: 3, resolvedComments: 2 } });
    expect(host.textContent).toContain("Moja izmijenjena priprema.");
  });

  it("a composition that finishes after the box was unchecked is dropped", async () => {
    const calls: Call[] = [];
    let finish: (v: PrepInput) => void = () => {};
    await mount(server(calls), () => new Promise<PrepInput | null>((resolve) => { finish = resolve; }));
    await open();
    await click(checkbox());
    await click(checkbox());
    await act(async () => { finish(INPUT); });
    expect(checkbox().checked).toBe(false);
    expect(host.querySelector("textarea")).toBeNull();
  });

  it("the default composition reads the agreed tasks through the same client", async () => {
    const seen: string[] = [];
    const api = createApi({
      baseUrl: "https://ductura.example.invalid",
      fetchImpl: async (input) => {
        const path = new URL(String(input)).pathname;
        seen.push(path);
        return new Response(JSON.stringify(path.endsWith("/consultation-slot-details") ? { slots: [] } : { tasks: [] }), { status: 200, headers: { "content-type": "application/json" } });
      },
    });
    await mount(api, undefined as never);
    await open();
    await click(checkbox());
    expect(seen.some((p) => p.endsWith("/consultation-tasks"))).toBe(true);
  });

  it("without the checkbox the request carries no preparation and uses the older route", async () => {
    const calls: Call[] = [];
    await mount(server(calls), async () => INPUT);
    await open();
    await click(button("Pošalji mentoru"));
    expect(calls[0]![0]).toBe(`/api/v1/works/${DOC}/consultation-slots`);
    expect(calls[0]![1]).not.toHaveProperty("preparation");
  });

  it("a preparation that cannot be composed says so and the request still goes without it", async () => {
    const calls: Call[] = [];
    await mount(server(calls), async () => ({ ...INPUT, changed: null }));
    await open();
    await click(checkbox());
    expect(host.querySelector('[role="alert"]')?.textContent).toContain("nije moguće složiti");
    await click(button("Pošalji mentoru"));
    expect(calls[0]![1]).not.toHaveProperty("preparation");
  });

  it("a blank or over-long text is not sent and the form keeps it", async () => {
    const calls: Call[] = [];
    await mount(server(calls), async () => INPUT);
    await open();
    await click(checkbox());
    const area = () => host.querySelector("textarea") as HTMLTextAreaElement;
    await type(area(), "   ");
    await click(button("Pošalji mentoru"));
    expect(host.textContent).toContain("Priprema je prazna");
    await type(area(), "a".repeat(4001));
    await click(button("Pošalji mentoru"));
    expect(host.textContent).toContain("Priprema je preduga");
    expect(calls).toEqual([]);
    expect(area().value).toHaveLength(4001);
  });

  it("an unknown outcome keeps the text as typed and shows no success", async () => {
    const calls: Call[] = [];
    await mount(server(calls, true), async () => INPUT);
    await open();
    await click(checkbox());
    await type(host.querySelector("textarea") as HTMLTextAreaElement, "Sačuvani tekst.");
    await click(button("Pošalji mentoru"));
    expect(host.textContent).toContain("Nije poznato je li promjena zabilježena");
    expect((host.querySelector("textarea") as HTMLTextAreaElement).value).toBe("Sačuvani tekst.");
    expect(host.textContent).not.toContain("Priložena priprema");
  });

  it("the teacher has no request form and so no checkbox", async () => {
    await mount(server([]), async () => INPUT, "teacher");
    expect(host.querySelector('input[type="checkbox"]')).toBeNull();
  });
});
