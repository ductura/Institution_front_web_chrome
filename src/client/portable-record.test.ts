import { expect, it, vi } from "vitest";
import { downloadPortableRecord } from "./portable-record";

const ORIGIN = "https://ductura.example.invalid";
const ID = "5b1f0c7e-3d2a-4c8e-9a41-0f6e2d7b8c13";
const answer = (response: Response) => vi.fn<typeof fetch>(async () => response);

it("asks the server for the record of that submission and returns its bytes untouched", async () => {
  const transport = answer(new Response(new Uint8Array([1, 2, 3]), { status: 200, headers: { "content-type": "application/zip", "content-disposition": 'attachment; filename="zapis-demo.zip"' } }));
  const result = await downloadPortableRecord(ID, { baseUrl: ORIGIN, transport });
  expect(result).toMatchObject({ kind: "ready", filename: "zapis-demo.zip", type: "application/zip" });
  expect(result.kind === "ready" && [...new Uint8Array(result.bytes)]).toEqual([1, 2, 3]);
  expect(transport).toHaveBeenCalledWith(new URL(`${ORIGIN}/api/v1/student/submissions/${ID}/portable-record`), expect.objectContaining({ method: "GET" }));
});

it("names the file itself when the server does not", async () => {
  const result = await downloadPortableRecord(ID, { baseUrl: ORIGIN, transport: answer(new Response("x", { status: 200 })) });
  expect(result).toMatchObject({ kind: "ready", filename: "prenosivi-zapis-5b1f0c7e.zip" });
});

it.each([[401, "signedOut"], [403, "notFound"], [404, "notFound"], [500, "unavailable"], [503, "unavailable"], [204, "unavailable"]] as const)(
  "status %i is %s", async (status, kind) => {
    const result = await downloadPortableRecord(ID, { baseUrl: ORIGIN, transport: answer(new Response(null, { status })) });
    expect(result.kind).toBe(kind);
  });

it("an empty 200 and a broken connection are unavailable", async () => {
  expect((await downloadPortableRecord(ID, { baseUrl: ORIGIN, transport: answer(new Response(new Uint8Array(), { status: 200 })) })).kind).toBe("unavailable");
  expect((await downloadPortableRecord(ID, { baseUrl: ORIGIN, transport: vi.fn(async () => { throw new TypeError("offline"); }) })).kind).toBe("unavailable");
});

it("an id that is not a UUID never reaches the network", async () => {
  const transport = vi.fn<typeof fetch>();
  expect((await downloadPortableRecord("../x", { baseUrl: ORIGIN, transport })).kind).toBe("notFound");
  expect(transport).not.toHaveBeenCalled();
});
