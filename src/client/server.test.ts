// WEB-02: the /api/v1 bridge of the Next.js app, over a fake transport.
import { describe, expect, it } from "vitest";

import { cookieTransport, forwardToServer } from "./api";
import { DEFAULT_SERVER_URL, institutionServerUrl } from "./server";

type Seen = { url: string; init: RequestInit };

function fakeServer(response: () => Response) {
  const seen: Seen[] = [];
  const transport: typeof fetch = async (input, init) => {
    seen.push({ url: String(input), init: init ?? {} });
    return response();
  };
  return { seen, transport };
}

describe("institutionServerUrl", () => {
  it("is the local server without INSTITUTION_SERVER_URL or with an empty one", () => {
    expect(institutionServerUrl({})).toBe(DEFAULT_SERVER_URL);
    expect(institutionServerUrl({ INSTITUTION_SERVER_URL: "  " })).toBe(DEFAULT_SERVER_URL);
  });

  it("takes the variable without trailing slashes", () => {
    expect(institutionServerUrl({ INSTITUTION_SERVER_URL: "http://srv.test:4000//" })).toBe("http://srv.test:4000");
  });
});

describe("forwardToServer", () => {
  it("passes method, path, query, body and cookie on, without hop-by-hop headers", async () => {
    const { seen, transport } = fakeServer(() => Response.json({ ok: true }));
    const request = new Request("http://web.test:3000/api/v1/institution/enrollments?x=1", {
      method: "POST",
      headers: { cookie: "s=abc", "content-type": "application/json", connection: "keep-alive", origin: "http://web.test:3000" },
      body: JSON.stringify({ code: "UPIS2026DEMO" }),
    });
    const res = await forwardToServer(request, "http://srv.test:4000", transport);
    expect(res.status).toBe(200);
    expect(seen).toHaveLength(1);
    const [call] = seen;
    expect(call?.url).toBe("http://srv.test:4000/api/v1/institution/enrollments?x=1");
    expect(call?.init.method).toBe("POST");
    expect(call?.init.redirect).toBe("manual");
    const headers = new Headers(call?.init.headers);
    expect(headers.get("cookie")).toBe("s=abc");
    expect(headers.get("origin")).toBe("http://web.test:3000");
    expect(headers.get("connection")).toBeNull();
    expect(headers.get("x-forwarded-host")).toBe("web.test:3000");
    expect(headers.get("x-forwarded-proto")).toBe("http");
    expect(new TextDecoder().decode(call?.init.body as ArrayBuffer)).toBe('{"code":"UPIS2026DEMO"}');
  });

  it("returns a redirect as it is, with every Set-Cookie", async () => {
    const { transport } = fakeServer(() => {
      const headers = new Headers({ location: "/" });
      headers.append("set-cookie", "s=; Max-Age=0; Path=/; HttpOnly");
      headers.append("set-cookie", "t=1; Path=/");
      return new Response(null, { status: 303, headers });
    });
    const res = await forwardToServer(new Request("http://web.test/api/v1/auth/logout", { method: "POST" }), "http://srv.test", transport);
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/");
    expect(res.headers.getSetCookie()).toEqual(["s=; Max-Age=0; Path=/; HttpOnly", "t=1; Path=/"]);
  });

  it("sends no body for GET and drops the encoding the transport already undid", async () => {
    const { seen, transport } = fakeServer(() => new Response("{}", { headers: { "content-encoding": "gzip", "content-type": "application/json" } }));
    const res = await forwardToServer(new Request("http://web.test/api/v1/me"), "http://srv.test", transport);
    expect(seen[0]?.init.body).toBeUndefined();
    expect(res.headers.get("content-encoding")).toBeNull();
    expect(res.headers.get("content-type")).toBe("application/json");
    expect(await res.text()).toBe("{}");
  });

  it("does not pass on a path outside /api/v1/", async () => {
    const { seen, transport } = fakeServer(() => Response.json({}));
    for (const path of ["/api/v10/me", "/api/v1", "/api/other", "/"]) {
      const res = await forwardToServer(new Request(`http://web.test${path}`), "http://srv.test", transport);
      expect(res.status).toBe(404);
    }
    expect(seen).toEqual([]);
  });

  it("is 502 when the server cannot be reached", async () => {
    const transport: typeof fetch = async () => {
      throw new TypeError("fetch failed");
    };
    const res = await forwardToServer(new Request("http://web.test/api/v1/me"), "http://srv.test", transport);
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: "server_unavailable" });
  });
});

describe("cookieTransport", () => {
  it("adds the request's cookie and keeps the other headers", async () => {
    const { seen, transport } = fakeServer(() => Response.json({}));
    await cookieTransport("s=abc", transport)("http://srv.test/api/v1/me", { headers: { accept: "application/json" } });
    const headers = new Headers(seen[0]?.init.headers);
    expect(headers.get("cookie")).toBe("s=abc");
    expect(headers.get("accept")).toBe("application/json");
  });

  it("sends no cookie header when there is none", async () => {
    const { seen, transport } = fakeServer(() => Response.json({}));
    await cookieTransport("", transport)("http://srv.test/api/v1/me");
    expect(new Headers(seen[0]?.init.headers).has("cookie")).toBe(false);
  });
});
