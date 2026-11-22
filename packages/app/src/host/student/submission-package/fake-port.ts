// An in-memory server for the registrar's package (WEB-1803; WEB-2004), invented data. Tests and the catalogue only.
import { packageFilePath, type PackageCall, type PackageKind } from "./contract";

export const SUBMISSION = "00000000-0000-4000-8000-0000000000c1";
export const TOKEN = "1763800000000.AbCdEfGhIjKlMnOpQrStUvWxYz0123456789_-aBcDe";

export function fakePackageServer(opts: { expiresAt?: string } = {}) {
  const posts: { params?: unknown; body?: unknown }[] = [];
  const call: PackageCall = async (_id, input) => {
    posts.push({ params: input.params, body: input.body });
    const kind = (input.body as { kind: PackageKind }).kind;
    const submissionId = input.params?.submissionId ?? SUBMISSION;
    return {
      ok: true as const,
      status: 201,
      body: { kind, downloadPath: `${packageFilePath(submissionId, kind)}?token=${TOKEN}`, expiresAt: opts.expiresAt ?? "2099-12-01T12:00:00.000Z" },
    };
  };
  return { call, posts };
}
