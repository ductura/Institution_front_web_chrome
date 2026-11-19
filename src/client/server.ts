// WEB-02 (Ductus#2028 c.7008147932): reads on the server side of the Next.js
// app. A page passes its request's Cookie header (from next/headers) and calls
// the same createApi as the browser, against INSTITUTION_SERVER_URL.
import { cookieTransport, createApi, forwardToServer, type ApiOptions } from "./api";

/** The institution server of the local stack (Institution_server `pnpm lokalno`), as dev-server.mjs has it. */
export const DEFAULT_SERVER_URL = "http://127.0.0.1:4000";

/** The institution server's origin: INSTITUTION_SERVER_URL, or the local one; no trailing slash. */
export function institutionServerUrl(env: Readonly<Record<string, string | undefined>> = process.env): string {
  const value = env.INSTITUTION_SERVER_URL?.trim();
  return (value === undefined || value === "" ? DEFAULT_SERVER_URL : value).replace(/\/+$/, "");
}

/** createApi for a server-side page: the institution server, with the request's cookie. */
export function serverApi(cookie: string, options: Omit<ApiOptions, "baseUrl" | "fetchImpl"> = {}) {
  return createApi({ ...options, baseUrl: institutionServerUrl(), fetchImpl: cookieTransport(cookie) });
}

/** The route handler under SERVER_PREFIX (src/client/api.ts): the request, passed on to the institution server. */
export function forwardRequest(request: Request): Promise<Response> {
  return forwardToServer(request, institutionServerUrl());
}
