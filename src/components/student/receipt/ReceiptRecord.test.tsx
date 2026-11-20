import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ReceiptRecord } from "./ReceiptRecord";
import { receiptRecordMessages as t } from "./messages.hr";

describe("ReceiptRecord (WEB-9E, E-11)", () => {
  const markup = renderToStaticMarkup(<ReceiptRecord assignmentId="44444444-4444-4444-8444-444444444444" homeHref="/zadaci" />);
  it("offers the PDF with a QR code and says the public check is not available yet, without a made-up link", () => {
    expect(markup).toContain(t.pdf);
    expect(markup).toContain(t.qrNote);
    expect(markup).toContain(t.verifyPending);
    expect(markup).not.toContain("/provjera");
    expect(markup.match(/<a /g)).toHaveLength(1);
  });
  it("shows no problem before a click", () => {
    expect(markup).not.toContain('role="alert"');
  });
});
