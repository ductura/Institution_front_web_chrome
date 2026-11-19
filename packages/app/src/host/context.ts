"use client";

import { createContext, useContext } from "react";

import type { ShellRole } from "../../../../src/components/index.ts";

import type { Base } from "../bases";
import type { Page } from "../routes";

/** What the host knows when it shows a page: the base, the page of the path and the session's role. */
export type HostValue = { readonly base: Base; readonly page: Page; readonly role: ShellRole | null };

export const HostContext = createContext<HostValue | null>(null);

/** The host's value; a page outside the host is a mistake of the routes. */
export function useHost(): HostValue {
  const value = useContext(HostContext);
  if (value === null) throw new Error("useHost outside app/[base]/layout.tsx");
  return value;
}
