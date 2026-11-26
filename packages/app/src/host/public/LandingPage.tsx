"use client";

import { Landing } from "../../../../../src/components/landing/Landing";
import { useHost } from "../context";

// DAN-1520: the public home page; the host gives the address prefix for its links.
export default function LandingPage() {
  const { base } = useHost();
  return <Landing base={base} />;
}
