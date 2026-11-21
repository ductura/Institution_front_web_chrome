import { expect, it, vi } from "vitest";

import { fetchRecord, portableRecordLabels, stateOf } from "./model";
import { portableRecordText as text } from "./messages.hr";

const ORIGIN = "https://ductura.example.invalid";
const ID = "5b1f0c7e-3d2a-4c8e-9a41-0f6e2d7b8c13";
const serve = (response: Response) => vi.fn<typeof fetch>(async () => response);

it("ready: the file is handed over and the card goes back to ready", async () => {
  const { state, file } = await fetchRecord(ID, { baseUrl: ORIGIN, transport: serve(new Response("zip", { status: 200 })) });
  expect(state).toEqual({ kind: "ready" });
  expect(file?.filename).toBe("prenosivi-zapis-5b1f0c7e.zip");
});

it("404 says the catalogue message and gives no file", async () => {
  const { state, file } = await fetchRecord(ID, { baseUrl: ORIGIN, transport: serve(new Response(null, { status: 404 })) });
  expect(state).toEqual({ kind: "error", message: text.notFound });
  expect(file).toBeNull();
});

it("an unreachable server says unavailable; an ended session goes to sign-in", async () => {
  expect(stateOf({ kind: "unavailable" })).toEqual({ kind: "error", message: text.unavailable });
  expect(stateOf({ kind: "signedOut" })).toBe("signedOut");
});

it("the texts are Croatian, plain and hold no number", () => {
  const all = [...portableRecordLabels.contents, ...portableRecordLabels.howTo, portableRecordLabels.title, text.notFound, text.unavailable].join(" ");
  expect(all).not.toMatch(/\d/);
  expect(all).not.toMatch(/\b(hash|checksum|payload|endpoint|API|JSON|CLI|token)\b/i);
  expect(all).toMatch(/QR/);
  expect(all).toMatch(/Provjera/);
});
