import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { findForbiddenTerms } from "../../../scripts/forbidden-terms/terms";
import { publicVerificationHr as t } from "../../components/public-verification/messages.hr";
import { VerificationFeedback } from "../../components/public-verification/VerificationForm";

import PublicVerificationPage, { metadata } from "./page";

describe("WEB-9C public verification page", () => {
  it("offers the code field and submit button without account or navigation links", () => {
    const html = renderToStaticMarkup(<PublicVerificationPage />);
    expect(html).toContain("<h1");
    expect(html).toContain(t.title);
    expect(html).toContain(t.code);
    expect(html).toContain(t.submit);
    expect(html).not.toMatch(/href=|\baction=|\bname=/);
    expect(metadata.referrer).toBe("no-referrer");
  });

  it("shows the permitted receipt metadata with a confirmed match", () => {
    const html = renderToStaticMarkup(<VerificationFeedback state={{
      kind: "matched",
      submittedAt: "2026-11-20T12:05:00Z",
      signedAt: "2026-11-20T12:06:00Z",
      keyId: "izmisljeni-kljuc",
    }} />);
    expect(html).toContain('role="status"');
    expect(html).toContain(t.matched);
    expect(html).toContain("20. studenoga 2026. 13:05");
    expect(html).toContain("20. studenoga 2026. 13:06");
    expect(html).toContain("izmisljeni-kljuc");
  });

  it.each(["invalid", "pending", "notMatched", "unavailable", "rateLimited"] as const)(
    "shows %s without asserting a match or exposing receipt details",
    (kind) => {
      const html = renderToStaticMarkup(<VerificationFeedback state={{ kind }} />);
      expect(html).toContain(t[kind]);
      expect(html).not.toContain(t.matched);
      expect(html).not.toContain("<time");
      expect(html).not.toContain(t.keyId);
    },
  );

  it("keeps the Croatian copy within PRODUCT §5", () => {
    for (const message of Object.values(t)) expect(findForbiddenTerms(message, "hr")).toEqual([]);
  });
});
