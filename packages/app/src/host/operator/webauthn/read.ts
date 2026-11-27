import { createApi, type ApiOptions } from "@/client/api";
import { fromBase64Url, toBase64Url } from "./encode";

/** What the page may say after a ceremony; never a credential, a challenge or a server error text. */
export type CeremonyResult =
  | { kind: "done" }
  | { kind: "unsupported" | "cancelled" | "no-key" | "already" | "denied" | "rejected" | "replay" | "unavailable" };

/** The part of the browser's CredentialsContainer the ceremonies use; injected in tests. */
export type Credentials = Pick<CredentialsContainer, "create" | "get">;
type Options = ApiOptions & { credentials?: Credentials };

const RP_NAME = "Ductura";
const NO_QUERY = { params: undefined, query: undefined } as const;

function containerOf(options?: Options): Credentials | null {
  if (options?.credentials !== undefined) return options.credentials;
  return typeof navigator !== "undefined" && navigator.credentials !== undefined ? navigator.credentials : null;
}

function failure(status: number, code: string | undefined, step: "challenge" | "finish"): CeremonyResult {
  if (status === 401 || status === 403) return { kind: "denied" };
  if (status === 409) return { kind: code === "counter_not_increased" ? "replay" : "already" };
  if (step === "finish" && (status === 400 || status === 422)) return { kind: code === "challenge_invalid" ? "replay" : "rejected" };
  return { kind: "unavailable" };
}
const codeOf = (answer: { code?: string }) => answer.code;

/** F4-PM2-R16: add a key (registration ceremony); the server issues the challenge and checks the answer. */
export async function registerKey(options?: Options): Promise<CeremonyResult> {
  const credentials = containerOf(options);
  if (credentials === null) return { kind: "unsupported" };
  try {
    const call = createApi(options);
    const issued = await call("auth.webauthn-challenge.post", { ...NO_QUERY, body: { purpose: "registration" } });
    if (!issued.ok) return failure(issued.status, codeOf(issued), "challenge");
    const challenge = issued.body;
    if (challenge.purpose !== "registration") return { kind: "unavailable" };
    let made: Credential | null;
    try {
      made = await credentials.create({
        publicKey: {
          challenge: fromBase64Url(challenge.challenge),
          rp: { id: challenge.rpId, name: RP_NAME },
          user: { id: fromBase64Url(challenge.userHandle), name: "operater", displayName: "Operater" },
          pubKeyCredParams: [{ type: "public-key", alg: -7 }],
          authenticatorSelection: { userVerification: "required" },
          attestation: "none",
          timeout: challenge.timeoutMs,
        },
      });
    } catch {
      return { kind: "cancelled" };
    }
    const pk = made as PublicKeyCredential | null;
    const response = pk?.response as AuthenticatorAttestationResponse | undefined;
    if (pk === null || response === undefined || typeof response.getAuthenticatorData !== "function") return { kind: "unsupported" };
    const sent = await call("auth.webauthn-registration.post", {
      ...NO_QUERY,
      body: {
        credentialId: toBase64Url(pk.rawId),
        clientDataJSON: toBase64Url(response.clientDataJSON),
        authenticatorData: toBase64Url(response.getAuthenticatorData()),
      },
    });
    return sent.ok ? { kind: "done" } : failure(sent.status, codeOf(sent), "finish");
  } catch {
    return { kind: "unavailable" };
  }
}

/** F4-PM2-R16: confirm the session with a key already added (assertion ceremony). No key on record is its own result. */
export async function confirmWithKey(options?: Options): Promise<CeremonyResult> {
  const credentials = containerOf(options);
  if (credentials === null) return { kind: "unsupported" };
  try {
    const call = createApi(options);
    const issued = await call("auth.webauthn-challenge.post", { ...NO_QUERY, body: { purpose: "assertion" } });
    if (!issued.ok) return failure(issued.status, codeOf(issued), "challenge");
    const challenge = issued.body;
    if (challenge.purpose !== "assertion") return { kind: "unavailable" };
    if (challenge.allowCredentials.length === 0) return { kind: "no-key" };
    let got: Credential | null;
    try {
      got = await credentials.get({
        publicKey: {
          challenge: fromBase64Url(challenge.challenge),
          rpId: challenge.rpId,
          allowCredentials: challenge.allowCredentials.map((id) => ({ type: "public-key" as const, id: fromBase64Url(id) })),
          userVerification: "required",
          timeout: challenge.timeoutMs,
        },
      });
    } catch {
      return { kind: "cancelled" };
    }
    const pk = got as PublicKeyCredential | null;
    const response = pk?.response as AuthenticatorAssertionResponse | undefined;
    if (pk === null || response === undefined || response.signature === undefined) return { kind: "unsupported" };
    const sent = await call("auth.webauthn-assertion.post", {
      ...NO_QUERY,
      body: {
        credentialId: toBase64Url(pk.rawId),
        clientDataJSON: toBase64Url(response.clientDataJSON),
        authenticatorData: toBase64Url(response.authenticatorData),
        signature: toBase64Url(response.signature),
      },
    });
    return sent.ok ? { kind: "done" } : failure(sent.status, codeOf(sent), "finish");
  } catch {
    return { kind: "unavailable" };
  }
}
