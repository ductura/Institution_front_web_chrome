import { cookies } from "next/headers";

import { cookieTransport } from "@/client/api";
import { institutionServerUrl } from "@/client/server";

import { readShellAccessWith, type ShellAccess } from "./shell-access";

/** The shell's access for this request: the server session read (me) on the institution server, with the request's cookies. */
export async function readShellAccess(): Promise<ShellAccess> {
  const cookie = (await cookies()).toString();
  return readShellAccessWith(cookie, institutionServerUrl(), cookieTransport(cookie));
}
