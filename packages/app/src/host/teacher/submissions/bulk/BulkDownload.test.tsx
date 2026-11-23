import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { GradeGate } from "../grade/GradeGate";
import type { GradeRead } from "../grade/contract";
import BulkDownload from "./BulkDownload";
import { bulkFilePath } from "./contract";
import { ASSIGNMENT, TOKEN, fakeBulkServer } from "./fake-port";
import { bulkText as t } from "./messages.hr";
import { mayFollow, msUntilExpiry } from "./model";

// PIL-D2-ZIP: the mounted bulk download as the submissions page composes it (GradeGate around it), invented data.
const page = (read: GradeRead | null) => renderToStaticMarkup(
  <GradeGate read={read} onRetry={() => {}}>
    <BulkDownload call={fakeBulkServer().call} assignmentId={ASSIGNMENT} />
  </GradeGate>,
);

describe("bulk download on the submissions page (PIL-D2-ZIP)", () => {
  it("a regular assignment offers the button and both formats, and no link before the server gives one", () => {
    const out = page({ kind: "graded" });
    for (const part of [t.title, t.action, t.formatPdf, t.formatDocx]) expect(out).toContain(part);
    expect(out).not.toContain("href=");
  });

  it("a practice assignment (P-D1) is never offered the download", () => {
    const out = page({ kind: "practice" });
    expect(out).not.toContain(t.action);
    expect(out).not.toContain(t.title);
  });

  it("nothing is offered while the grade route is unread, unavailable or refused", () => {
    for (const read of [null, { kind: "unavailable" }, { kind: "notFound" }, { kind: "signedOut" }] as (GradeRead | null)[]) {
      expect(page(read)).not.toContain(t.action);
    }
  });

  it("a link is followed only before its expiry, and one timer fires at that expiry", () => {
    const link = { format: "pdf", href: `${bulkFilePath(ASSIGNMENT, "pdf")}?token=${TOKEN}`, expiresAt: "2026-12-01T12:00:00.000Z" } as const;
    expect(mayFollow(link, new Date("2026-12-01T11:59:59.999Z"))).toBe(true);
    expect(mayFollow(link, new Date("2026-12-01T12:00:00.000Z"))).toBe(false);
    expect(msUntilExpiry(link, new Date("2026-12-01T11:59:00.000Z"))).toBe(60_000);
    expect(msUntilExpiry(link, new Date("2026-12-01T12:00:01.000Z"))).toBe(0);
    expect(msUntilExpiry({ ...link, expiresAt: "2099-12-01T12:00:00.000Z" }, new Date("2026-12-01T12:00:00.000Z"))).toBe(2_147_483_647);
  });

  it("the copy names the ZIP and a calm way on after expiry", () => {
    expect(t.idle).toContain("ZIP");
    expect(t.started).toContain("zatraži novu poveznicu");
  });
});
