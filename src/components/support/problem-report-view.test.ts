import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

import { messagesHr } from "../../../locales/hr.ts";
import { findForbiddenTerms } from "../../../scripts/forbidden-terms/terms.ts";
import { outcomeFromResponse, type ProblemReportBody, type ProblemReportCategory } from "./problem-report";
import type { FormStep } from "./problem-report-form";
import { createSender, formView, INITIAL_FORM, scheduleUnlock, unlockDelay, type FormContext, type FormState, type FormView } from "./problem-report-view";

// DAN-873-3: the form model over a fake server built from the verbatim copy of
// the route's vectors (blob 6bfb2d32); the clock is a number (Ductus#1836 c.6957789173).
type Vector = { name: string; kind: string; request: { body?: ProblemReportBody }; response: { status: number; body: unknown } };
const vectors = (JSON.parse(readFileSync(new URL("./fixtures/support.problem-report.post.json", import.meta.url), "utf8")) as { vectors: Vector[] }).vectors;
const vector = (name: string) => vectors.find((v) => v.name === name) as Vector;
const NOW = 1_800_000_000_000;
const t = messagesHr.support;
const fake = (v: Vector, retryAfter: string | null = null) =>
  vi.fn(async (_body: ProblemReportBody) => outcomeFromResponse(v.response.status, v.response.body, retryAfter, NOW));
const CONTEXT: FormContext = {
  appVersion: "1.4.0", pathname: "/zadaci", syncState: "SYNCED",
  userAgent: "Mozilla/5.0 (X11; Linux x86_64; rv:140.0) Gecko/20100101 Firefox/140.0",
};
const FILLED: FormState = { ...INITIAL_FORM, description: "Izmišljeni opis: gumb za spremanje ne reagira." };
const texts = (view: FormView) =>
  [view.heading, view.counter, view.check, view.alert, view.status, view.ended, view.button?.label, ...(view.sent ?? []),
    ...view.categories.flatMap((c) => [c.label, c.who])].filter((s): s is string => typeof s === "string");

describe("nothing is sent outside the classes (negative first)", () => {
  it.each(["", "   ", "\r\n\t", "  ", "​"])("empty description %j", async (description) => {
    const send = fake(vector("recorded"));
    const onSending = vi.fn();
    const state = await createSender(send)({ ...INITIAL_FORM, description }, NOW, CONTEXT, onSending);
    expect(send).not.toHaveBeenCalled();
    expect(onSending).not.toHaveBeenCalled();
    const view = formView(state, NOW);
    expect(view).toMatchObject({ check: t.check.empty, invalid: true, sent: null });
    expect(formView({ ...state, description: "Sada ima opis." }, NOW)).toMatchObject({ check: null, invalid: false });
  });

  it.each(["toString", "__proto__"])("category %s", async (category) => {
    const send = fake(vector("recorded"));
    const state = { ...FILLED, category: category as ProblemReportCategory };
    await expect(createSender(send)(state, NOW, CONTEXT, vi.fn())).resolves.toBe(state);
    expect(send).not.toHaveBeenCalled();
  });

  it("a second press while the first is in flight sends nothing", async () => {
    let answer: (o: Awaited<ReturnType<ReturnType<typeof fake>>>) => void = () => {};
    const send = vi.fn((_body: ProblemReportBody) => new Promise<ReturnType<typeof outcomeFromResponse>>((r) => { answer = r; }));
    const onSending = vi.fn();
    const press = createSender(send);
    const first = press(FILLED, NOW, CONTEXT, onSending);
    await expect(press(FILLED, NOW, CONTEXT, onSending)).resolves.toBe(FILLED);
    expect(send).toHaveBeenCalledTimes(1);
    expect(onSending).toHaveBeenCalledTimes(1);
    expect(formView(onSending.mock.calls[0]![0] as FormState, NOW)).toMatchObject({ status: t.sending, button: { disabled: true } });
    answer({ kind: "sent", reference: "PR-0000000001" });
    await expect(first).resolves.toMatchObject({ step: { kind: "sent" } });
  });

  it("after a 429 with retry-after: 120 sending stays locked until the fake clock reaches it", async () => {
    const locked = await createSender(fake(vector("too-many-reports"), "120"))(FILLED, NOW, CONTEXT, vi.fn());
    expect(formView(locked, NOW + 119_999)).toMatchObject({ button: { label: t.retry, disabled: true }, alert: `${t.failedLead} ${t.failure.tooMany}` });
    const again = fake(vector("recorded"));
    await expect(createSender(again)(locked, NOW + 119_999, CONTEXT, vi.fn())).resolves.toBe(locked);
    expect(again).not.toHaveBeenCalled();
    expect(formView(locked, NOW + 120_000).button).toEqual({ label: t.retry, disabled: false });
    await createSender(again)(locked, NOW + 120_000, CONTEXT, vi.fn());
    expect(again).toHaveBeenCalledTimes(1);

    expect([NOW, NOW + 119_999, NOW + 120_000].map((now) => unlockDelay(locked.step, now))).toEqual([120_000, 1, null]);
    expect(unlockDelay({ kind: "failed", lead: "support.failedLead", messageKey: "support.failure.tooMany", retryAt: null }, NOW)).toBeNull();
    expect(unlockDelay({ kind: "editing" }, NOW)).toBeNull();

    const setTimer = vi.fn((_run: () => void, _ms: number) => 7);
    const clearTimer = vi.fn();
    const onUnlock = vi.fn();
    const cancel = scheduleUnlock(locked.step, NOW, setTimer, clearTimer, onUnlock);
    expect(setTimer).toHaveBeenCalledTimes(1);
    expect(setTimer.mock.calls[0]![1]).toBe(120_000);
    setTimer.mock.calls[0]![0]();
    expect(onUnlock).toHaveBeenCalledTimes(1);
    cancel();
    expect(clearTimer).toHaveBeenCalledWith(7);
    scheduleUnlock({ kind: "editing" }, NOW, setTimer, clearTimer, onUnlock)();
    expect(setTimer).toHaveBeenCalledTimes(1);
  });

  it("a send that throws leaves the form failed with the description kept, not sending", async () => {
    const state = await createSender(vi.fn(async () => { throw new Error("offline"); }))(FILLED, NOW, CONTEXT, vi.fn());
    expect(state.description).toBe(FILLED.description);
    expect(formView(state, NOW)).toMatchObject({ alert: `${t.keptLead} ${t.failure.network}`, button: { disabled: false } });
  });
});

describe("the route's vectors drive what the form shows", () => {
  it.each(vectors.filter((v) => v.kind === "success").map((v) => v.name))("%s shows the confirmation", async (name) => {
    const v = vector(name);
    const body = v.request.body as ProblemReportBody;
    const send = fake(v);
    const context: FormContext = {
      appVersion: body.appVersion, pathname: body.route ?? "/nepoznato/123", syncState: body.syncState,
      userAgent: body.browser.family === "firefox" ? CONTEXT.userAgent : "curl/8.0",
    };
    const state = await createSender(send)({ ...INITIAL_FORM, category: body.category, description: body.description }, NOW, context, vi.fn());
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith(body);
    const reference = (v.response.body as { reference: string }).reference;
    expect(formView(state, NOW)).toMatchObject({
      heading: t.sentTitle, sent: [t.sentReference.replace("{reference}", reference), t.sentNote], button: null, categories: [],
    });
  });

  it("503 keeps the description without saying it was not sent; 403 says it was not sent", async () => {
    const unavailable = formView(await createSender(fake(vector("unavailable")))(FILLED, NOW, CONTEXT, vi.fn()), NOW);
    expect(unavailable.alert).toBe(`${t.keptLead} ${t.failure.unavailable}`);
    expect(unavailable.alert).not.toMatch(/nije poslana/);
    const origin = formView(await createSender(fake(vector("origin-missing")))(FILLED, NOW, CONTEXT, vi.fn()), NOW);
    expect(origin.alert).toBe(`${t.failedLead} ${messagesHr.errors.originMissing}`);
  });

  it("no text the form can show has a forbidden term", async () => {
    const shown: string[] = [];
    for (const v of vectors) shown.push(...texts(formView(await createSender(fake(v, "60"))(FILLED, NOW, CONTEXT, vi.fn()), NOW)));
    const ended: FormStep = { kind: "ended", delivery: "notSent" };
    shown.push(...texts(formView({ ...INITIAL_FORM, step: ended }, NOW)));
    for (const description of ["", "a".repeat(1001), "a\u007Fb"]) shown.push(...texts(formView({ ...INITIAL_FORM, description, shownCheck: true }, NOW)));
    expect(shown).toContain(t.ended);
    expect(shown).toContain(t.check.invalid);
    expect(shown).toContain(t.check.tooLong.replace("{n}", "1001").replace("{max}", "1000"));
    expect(shown.flatMap((text) => findForbiddenTerms(text, "hr"))).toEqual([]);
  });
});
