import { describe, expect, it, vi } from "vitest";

import { requestWorkDocx } from "../../../../client/work-export";

const type = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const snapshotSha256 = "1234567890ab" + "c".repeat(52);

describe("requestWorkDocx", () => {
  it("requests the exact saved revision and reads the DOCX and snapshot fingerprint", async () => {
    const signal = new AbortController().signal;
    const request = vi.fn(async () => new Response("Izmišljeni rad", {
      headers: { "Content-Type": type, "X-Export-Snapshot-Sha256": snapshotSha256 },
    }));

    const result = await requestWorkDocx("demo/rad", "42", signal, request);

    expect(request).toHaveBeenCalledExactlyOnceWith("/api/v1/works/demo%2Frad/export?format=docx&versionId=42",
      expect.objectContaining({ method: "GET", headers: { Accept: type }, signal }));
    expect(result).toMatchObject({ ok: true, snapshotSha256 });
    if (result.ok) expect(await result.blob.text()).toBe("Izmišljeni rad");
  });

  it.each([[404, "notFound"], [422, "invalidRequest"]] as const)("maps HTTP %i to %s", async (status, reason) => {
    const request = async () => new Response(null, { status });
    await expect(requestWorkDocx("demo-rad", "42", new AbortController().signal, request))
      .resolves.toEqual({ ok: false, reason });
  });
});
