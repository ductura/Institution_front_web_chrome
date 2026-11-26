import { describe, expect, it, vi } from "vitest";

import { consentDetail, formsDetail, loadMentorConsent, loadThesisForms } from "./SubmissionRehearsal";
import { rehearsalMessagesHr as t } from "./messages.hr";

const documentId = "a8ee8f83-2949-4a99-b358-be77cd4938dd";
const baseUrl = "https://ductura.example.invalid";
const consentBody = (state: string, requiredForSubmission = false) =>
  ({ state, changedBy: null, changedAt: null, comment: null, requiredForSubmission, history: [] });
const answering = (body: unknown, status = 200) => vi.fn<typeof fetch>(async () => Response.json(body, { status }));

describe("mentor consent in the submission rehearsal (EDI-R03)", () => {
  it("reads the server's consent for this work", async () => {
    const fetchImpl = answering(consentBody("given"));
    expect(await loadMentorConsent(documentId, { baseUrl, fetchImpl })).toEqual({ kind: "given" });
    expect(String(fetchImpl.mock.calls[0]![0])).toContain(`/works/${documentId}/mentor-consent`);
  });

  it.each([
    ["given", false, { kind: "given" }],
    ["withdrawn", true, { kind: "withdrawn" }],
    ["none", true, { kind: "none", required: true }],
    ["none", false, { kind: "none", required: false }],
  ])("maps %s (required %s)", async (state, required, expected) => {
    expect(await loadMentorConsent(documentId, { baseUrl, fetchImpl: answering(consentBody(state, required)) })).toEqual(expected);
  });

  it.each([[404], [401], [500]])("a %i answer is unavailable, never 'not asked for'", async (status) => {
    const body = { error: { code: "not_found", message: "x" } };
    expect(await loadMentorConsent(documentId, { baseUrl, fetchImpl: answering(body, status) })).toEqual({ kind: "unavailable" });
  });

  it("a malformed answer or a failed transport is unavailable", async () => {
    expect(await loadMentorConsent(documentId, { baseUrl, fetchImpl: answering({ state: "maybe" }) })).toEqual({ kind: "unavailable" });
    const fetchImpl = vi.fn<typeof fetch>(async () => { throw new Error("offline"); });
    expect(await loadMentorConsent(documentId, { baseUrl, fetchImpl })).toEqual({ kind: "unavailable" });
  });

  it("words each state, and loading is not 'none'", () => {
    expect(consentDetail(undefined)).toBe(t.approvalChecking);
    expect(consentDetail({ kind: "given" })).toBe(t.approvalGiven);
    expect(consentDetail({ kind: "withdrawn" })).toBe(t.approvalWithdrawn);
    expect(consentDetail({ kind: "none", required: true })).toBe(t.approvalNoneRequired);
    expect(consentDetail({ kind: "none", required: false })).toBe(t.approvalNone);
    expect(consentDetail({ kind: "unavailable" })).toBe(t.approvalUnavailable);
  });
});

describe("thesis forms in the submission rehearsal (MEN-R07)", () => {
  const form = (state: string) => ({ code: "f1", version: 1, title: "Obrazac", state, stateFormVersion: null, changedAt: null, changedBy: null, changedByPart: null });

  it("counts the accepted forms from work.thesis-forms.get", async () => {
    const fetchImpl = answering({ forms: [form("accepted"), form("submitted"), form("not_submitted")] });
    expect(await loadThesisForms(documentId, { baseUrl, fetchImpl })).toEqual({ kind: "ready", total: 3, accepted: 1 });
    expect(String(fetchImpl.mock.calls[0]![0])).toContain(`/works/${documentId}/thesis-forms`);
  });

  it("a work of another or without mentorship (404) has none; a list without forms has none", async () => {
    const notFound = { error: { code: "not_found", message: "x" } };
    expect(await loadThesisForms(documentId, { baseUrl, fetchImpl: answering(notFound, 404) })).toEqual({ kind: "none" });
    expect(await loadThesisForms(documentId, { baseUrl, fetchImpl: answering({ forms: [] }) })).toEqual({ kind: "none" });
  });

  it.each([[401], [500]])("a %i answer is unavailable, never 'none'", async (status) => {
    expect(await loadThesisForms(documentId, { baseUrl, fetchImpl: answering({ error: { code: "x", message: "x" } }, status) })).toEqual({ kind: "unavailable" });
  });

  it("a malformed answer or a failed transport is unavailable", async () => {
    expect(await loadThesisForms(documentId, { baseUrl, fetchImpl: answering({ forms: [{ state: 1 }] }) })).toEqual({ kind: "unavailable" });
    expect(await loadThesisForms(documentId, { baseUrl, fetchImpl: answering({}) })).toEqual({ kind: "unavailable" });
    const fetchImpl = vi.fn<typeof fetch>(async () => { throw new Error("offline"); });
    expect(await loadThesisForms(documentId, { baseUrl, fetchImpl })).toEqual({ kind: "unavailable" });
  });

  it("words the row: declaration form first, then the thesis forms, unavailable is said", () => {
    expect(formsDetail("Obrazac izjave: a.", undefined)).toBe("Obrazac izjave: a.");
    expect(formsDetail("Obrazac izjave: a.", { kind: "none" })).toBe("Obrazac izjave: a.");
    expect(formsDetail("Obrazac izjave: a.", { kind: "ready", total: 3, accepted: 1 })).toBe("Obrazac izjave: a. Obrasci završnog rada: 1 od 3 prihvaćeno.");
    expect(formsDetail(undefined, { kind: "unavailable" })).toBe(t.thesisFormsUnavailable);
  });
});
