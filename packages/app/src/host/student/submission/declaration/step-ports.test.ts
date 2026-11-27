import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { createApi } from "../../../../../../../src/client/api.ts";
import { writeNotice } from "../../statement/model";
import { createStepPorts, type StepRead } from "./step-ports";

// PIL-K-IZJAVA: the step on declaration-v1 against a recorded transport. Invented data only.
const ASSIGNMENT = "00000000-0000-4000-8000-0000000000a1";
const FORM = { formId: "test-izjava", formVersion: 1, formSha256: "a".repeat(64) };
const STATE = {
  state: "draft", submitted: false, currentRevision: 2, version: 4, formText: "Izmišljeni obrazac.",
  currentForm: { ...FORM, text: "Izmišljeni obrazac." },
  draft: {
    baseVersion: 3, revision: 2, form: FORM, ownWork: { confirmed: false },
    humanHelp: { received: true, entries: [{ kind: "language", text: "Izmišljena lektura." }] },
    ai: { use: "used", declaredTools: [{ toolLabel: "Izmišljeni alat", purposeText: "Lektura", phaseText: "Pisanje" }], attachments: [], externalAttachmentIds: [] },
    confirm: false,
  },
  payload: null, declarationSha256: null, uploads: [],
};
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const error = (status: number, code: string) => json(status, { error: code, code, messageKey: "errors.x", status, requestId: "00000000-0000-4000-8000-000000000000" });

type Put = { baseVersion: number; confirm: boolean; humanHelp: typeof STATE.draft.humanHelp };

/** A server that keeps one declaration and refuses a write on any version but the current one. */
function server(write?: (put: Put) => Response | null) {
  let state: typeof STATE = { ...STATE };
  const sent: { method: string; body: unknown; status: number }[] = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    // F4-PRE-R02: the assistant's list of conversations; none here (the v2 tests have their own).
    if (String(input).includes("/assistant-conversations")) return json(200, { assignmentId: ASSIGNMENT, conversations: [] });
    const method = init?.method ?? "GET";
    const body = typeof init?.body === "string" ? JSON.parse(init.body) as Put : undefined;
    let res: Response;
    if (method === "GET") res = json(200, state);
    else if (body === undefined) res = error(400, "invalid_input");
    else if (body.baseVersion !== state.version) res = error(409, "declaration_conflict");
    else {
      res = write?.(body) ?? (() => {
        state = { ...state, version: state.version + 1, state: body.confirm ? "confirmed" : "draft", draft: { ...state.draft, humanHelp: body.humanHelp } };
        return json(200, state);
      })();
    }
    sent.push({ method, body, status: res.status });
    return res;
  };
  return { sent, ports: createStepPorts(createApi({ baseUrl: "https://ductura.example.invalid", fetchImpl })) };
}

function shown(read: StepRead) {
  if (read.kind !== "read") throw new Error(`expected a read, got ${read.kind}`);
  return read;
}

describe("declaration step on declaration-v1 (PIL-K-IZJAVA)", () => {
  it("reads the declaration once for both halves and shows what the server holds", async () => {
    const s = server();
    const read = shown(await s.ports.read(ASSIGNMENT));
    expect(s.sent.map((r) => r.method)).toEqual(["GET"]);
    expect(read.confirmed).toBe(false);
    expect(read.view).toEqual({
      kind: "ready", recorded: [], chats: [], question: null,
      declared: { form: "used", tools: "Izmišljeni alat", purpose: "Lektura", phase: "Pisanje", humanHelp: { kind: "other", text: "Lektura ili korektura: Izmišljena lektura." } },
    });
    expect(read.statement).toMatchObject({ kind: "ready", statementText: "Izmišljeni obrazac.", humanHelp: { kind: "proofreading", text: "Izmišljena lektura." }, submitted: false });
  });

  it("the confirmation is written on the server; until the server holds it 'Dalje' stays closed", async () => {
    const s = server();
    const first = shown(await s.ports.read(ASSIGNMENT));
    expect(first.confirmed).toBe(false);
    expect(await s.ports.confirm(ASSIGNMENT)).toBe("saved");
    const put = s.sent.find((r) => r.method === "PUT");
    expect(put?.body).toMatchObject({ baseVersion: 4, confirm: true, ownWork: { confirmed: true }, ai: { use: "used" } });
    // A reload reads the confirmation back from the server, not from the browser.
    const again = shown(await s.ports.read(ASSIGNMENT));
    expect(again.confirmed).toBe(true);
  });

  it("the step and StudentStatement share one read and one version: no 409 between them", async () => {
    const s = server();
    await s.ports.read(ASSIGNMENT);
    expect(await s.ports.statement.saveHumanHelp(ASSIGNMENT, { kind: "content", text: "Izmišljena pomoć." })).toEqual({ kind: "saved" });
    // The confirmation goes on the version the statement's save returned, without a new read.
    expect(await s.ports.confirm(ASSIGNMENT)).toBe("saved");
    // Both halves refresh together, again on one GET.
    const read = shown(await s.ports.read(ASSIGNMENT));
    expect(read.confirmed).toBe(true);
    expect(read.statement).toMatchObject({ humanHelp: { kind: "content", text: "Izmišljena pomoć." } });
    expect(s.sent.map((r) => `${r.method} ${r.status}`)).toEqual(["GET 200", "PUT 200", "PUT 200", "GET 200"]);
  });

  it("a failed save stays visible and is never shown as saved", async () => {
    const s = server(() => error(503, "unavailable"));
    await s.ports.read(ASSIGNMENT);
    const write = await s.ports.statement.saveHumanHelp(ASSIGNMENT, { kind: "content", text: "Izmišljena pomoć." });
    expect(write.kind).not.toBe("saved");
    expect(writeNotice(write).tone).toBe("alert");
    const read = shown(await s.ports.read(ASSIGNMENT));
    expect(read.statement).toMatchObject({ humanHelp: { kind: "proofreading", text: "Izmišljena lektura." } });
    // The confirmation fails the same way: a technical error, not saved, and "Dalje" stays closed.
    expect(await s.ports.confirm(ASSIGNMENT)).toBe("technical");
    expect(shown(await s.ports.read(ASSIGNMENT)).confirmed).toBe(false);
  });

  it("names each answer of the confirmation: conflict, stale, refused, signed out", async () => {
    const cases: [Response, string][] = [
      [error(409, "declaration_conflict"), "conflict"],
      [error(409, "attachment_stale"), "stale"],
      [error(409, "incomplete"), "refused"],
      [error(422, "invalid_input"), "refused"],
      [error(401, "unauthorized"), "signedOut"],
    ];
    for (const [answer, outcome] of cases) {
      const s = server(() => answer.clone());
      await s.ports.read(ASSIGNMENT);
      expect(await s.ports.confirm(ASSIGNMENT), outcome).toBe(outcome);
    }
    // Nothing read, nothing to write on: no PUT, and it is a technical failure.
    const none = server();
    expect(await none.ports.confirm(ASSIGNMENT)).toBe("technical");
    expect(none.sent).toEqual([]);
  });

  it("a signed-out read sends the step to sign-in", async () => {
    const fetchImpl: typeof fetch = async () => error(401, "unauthorized");
    const ports = createStepPorts(createApi({ baseUrl: "https://ductura.example.invalid", fetchImpl }));
    expect(await ports.read(ASSIGNMENT)).toEqual({ kind: "signedOut" });
  });
});

describe("the duplicate StudentDeclaration is gone (PIL-K-IZJAVA)", () => {
  const root = new URL("../../../../../../../", import.meta.url).pathname;
  function sources(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
      const path = join(dir, name);
      if (name === "node_modules" || name.startsWith(".")) return [];
      return statSync(path).isDirectory() ? sources(path) : /\.(tsx?|mjs|js)$/.test(name) ? [path] : [];
    });
  }

  it("the folder is deleted and no import points at it", () => {
    expect(existsSync(join(root, "packages/app/src/host/student/declaration"))).toBe(false);
    const files = ["packages/app/src", "catalog/src", "src"].flatMap((dir) => sources(join(root, dir)));
    expect(files.length).toBeGreaterThan(100);
    const hits = files.filter((file) => /host\/student\/declaration\/|["'](?:\.\.\/)+declaration\/(?:StudentDeclaration|messages\.hr)["']/.test(readFileSync(file, "utf8")));
    expect(hits).toEqual([]);
  });
});
