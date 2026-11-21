import { expect, it, vi } from "vitest";

import { publishRules, readConfig } from "./client";
import type { Version } from "./rules";

const baseUrl = "https://ductura.example.invalid";
const first: Version = {
  version: 1,
  effectiveFrom: "2026-11-21T10:00:00.000Z",
  rules: { citationStyle: "fpzg", workLanguages: ["hr"], defaultWorkLanguage: "hr" },
};
const second: Version = {
  version: 2,
  effectiveFrom: "2026-11-21T11:00:00.000Z",
  rules: { citationStyle: "fpzg", workLanguages: ["hr", "en"], defaultWorkLanguage: "en" },
};

function reply(status: number, body: unknown) {
  return { baseUrl, fetchImpl: vi.fn<typeof fetch>(async () => Response.json(body, { status })) };
}

it("reads the administrator’s current rules and immutable versions through the contract", async () => {
  const data = { current: second, versions: [first, second] };
  const options = reply(200, data);
  await expect(readConfig(options)).resolves.toEqual({ kind: "ready", data });
  expect(options.fetchImpl).toHaveBeenCalledWith(new URL("/api/v1/institution/config", baseUrl), expect.objectContaining({ method: "GET" }));
  await expect(readConfig(reply(200, { current: null, versions: [] }))).resolves.toEqual({ kind: "ready", data: { current: null, versions: [] } });
  await expect(readConfig(reply(200, { current: first, versions: [first, second] }))).resolves.toEqual({ kind: "unavailable" });
  await expect(readConfig(reply(200, { ...data, extra: true }))).resolves.toEqual({ kind: "unavailable" });
});

it("handles access refusals without making rules available", async () => {
  await expect(readConfig(reply(401, { error: "unauthorized" }))).resolves.toEqual({ kind: "denied" });
  await expect(readConfig(reply(403, { error: "forbidden" }))).resolves.toEqual({ kind: "denied" });
  await expect(publishRules(1, second.rules, reply(403, { error: "forbidden" }))).resolves.toEqual({ kind: "denied" });
});

it("sends the reviewed rules and expected version and reads the version confirmed by the server", async () => {
  const options = reply(201, second);
  await expect(publishRules(1, second.rules, options)).resolves.toEqual({ kind: "published", version: second });
  const [url, request] = options.fetchImpl.mock.calls[0]!;
  expect(String(url)).toBe(`${baseUrl}/api/v1/institution/config/versions`);
  expect(request?.method).toBe("POST");
  expect(JSON.parse(String(request?.body))).toEqual({ expectedVersion: 1, ...second.rules });
  await expect(publishRules(1, second.rules, reply(201, first))).resolves.toEqual({ kind: "unknown" });
});

it("distinguishes a validation refusal, a concurrent publication and an unconfirmed publication", async () => {
  await expect(publishRules(1, second.rules, reply(422, { error: "invalid_input" }))).resolves.toEqual({ kind: "invalid" });
  await expect(publishRules(1, second.rules, reply(409, { error: "conflict" }))).resolves.toEqual({ kind: "conflict" });
  await expect(publishRules(1, second.rules, reply(503, { error: "unavailable" }))).resolves.toEqual({ kind: "unknown" });
});
