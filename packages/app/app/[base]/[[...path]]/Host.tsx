"use client";

import dynamic from "next/dynamic";

import type { Base } from "../../../src/bases";

// The host reads window.location from its first render, so it runs only in the browser.
const App = dynamic(() => import("../../../src/App"), { ssr: false });

export default function Host({ base }: { base: Base }) {
  return <App base={base} />;
}
