import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { messagesHr } from "@/lib/i18n/messages.hr";

import { publishHr } from "./messages.hr";
import { PublishDone } from "./PublishDone";
import { isUncertain, publishOutcome } from "./publish-outcome";

const errors = messagesHr.teacher.assignment.errors;

describe("publish outcome (WEB-2147)", () => {
  it("succeeds only when the server confirmed", () => {
    expect(publishOutcome({ kind: "available", id: "x" })).toEqual({ ok: true });
  });

  it.each(["invalid", "unauthorized", "forbidden", "conflict"] as const)("%s: server refused, data stays, not uncertain", (kind) => {
    const out = publishOutcome({ kind });
    expect(out).toEqual({ ok: false, error: `${publishHr.refused} ${errors[kind]}` });
    expect(isUncertain({ kind })).toBe(false);
  });

  it("unavailable: outcome unknown, prototype banner wording, locks the form", () => {
    const out = publishOutcome({ kind: "unavailable" });
    expect(out).toMatchObject({ ok: false, uncertain: true });
    expect(out.ok === false && out.error).toContain("Objava zadatka prekinuta je i ishod nije poznat.");
    expect(out.ok === false && out.error).toContain("provjerite popis zadataka");
    expect(isUncertain({ kind: "unavailable" })).toBe(true);
  });

  it("the confirmation never claims a notice was sent", () => {
    const html = renderToStaticMarkup(createElement(PublishDone));
    expect(html).toContain("Zadatak je objavljen.");
    expect(html).not.toMatch(/dobivaju obavijest|obavijest.*poslan/i);
  });
});
