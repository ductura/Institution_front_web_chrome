"use client";

import { appHref } from "../../../../../../src/components/index.ts";

import { useLocale } from "../../../i18n";
import { useHost } from "../../context";
import { AboutView } from "./AboutView";
import { demoHref } from "./demo-link";

/** DEMO-1: the public page "O aplikaciji"; the demo's address is inlined at build time. */
export default function AboutPage() {
  const { base } = useHost();
  const { t } = useLocale();
  return <AboutView t={t.landing} signInHref={appHref(base, "/prijava")} demoUrl={demoHref(process.env.NEXT_PUBLIC_DEMO_URL)} />;
}
