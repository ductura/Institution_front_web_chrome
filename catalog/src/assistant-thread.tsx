import { AssistantThread, type AssistantMessage } from "@ductura/ui";
import { useEffect, useState } from "react";

import { assistantThreadHr } from "../../src/components/pomocnik/messages.hr";
import type { CatalogState } from "./coverage";

const DEMO_ADDRESS = "demo-student@example.invalid";
const DEMO_REPLY = "Probni primjer: usporedite kompostiranje u posudi i na otvorenom.";
const SAMPLE: readonly AssistantMessage[] = [
  { id: "demo-1", role: "user", text: "Koje dvije metode kućnog kompostiranja mogu usporediti?" },
  { id: "demo-2", role: "assistant", text: DEMO_REPLY },
];

function AssistantThreadExample({ state }: { state: CatalogState }) {
  const [messages, setMessages] = useState(state === "prazno" ? [] : SAMPLE);
  const [draft, setDraft] = useState("");
  const [reviewing, setReviewing] = useState(false);
  const [waiting, setWaiting] = useState(false);

  useEffect(() => {
    if (!waiting) return;
    const timer = window.setTimeout(() => {
      setMessages((previous) => [...previous, { id: `demo-${previous.length + 1}`, role: "assistant", text: DEMO_REPLY }]);
      setWaiting(false);
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [waiting]);

  function send(text: string) {
    setMessages((previous) => [...previous, { id: `demo-${previous.length + 1}`, role: "user", text }]);
    setDraft("");
    setReviewing(false);
    setWaiting(true);
  }

  return <AssistantThread labels={assistantThreadHr} messages={messages} draft={draft} onDraftChange={setDraft}
    waiting={state === "učitavanje" || waiting} disabled={state === "onemogućeno"}
    error={state === "greška" && messages === SAMPLE && !waiting ? "Odgovor pomoćnika nije dostupan. Pokušajte ponovno." : undefined}
    onSend={(text) => {
      if (text.includes(DEMO_ADDRESS)) setReviewing(true);
      else send(text);
    }}
    privacyWarning={reviewing ? {
      kinds: ["email"],
      onRemoveAndSend: () => send(draft.trim().replaceAll(DEMO_ADDRESS, "[uklonjeno]")),
      onSendAnyway: () => send(draft.trim()),
      onCancel: () => setReviewing(false),
    } : undefined} />;
}

export const assistantThreadEntry = {
  prazno: () => <AssistantThreadExample state="prazno" />,
  učitavanje: () => <AssistantThreadExample state="učitavanje" />,
  greška: () => <AssistantThreadExample state="greška" />,
  puno: () => <AssistantThreadExample state="puno" />,
  onemogućeno: () => <AssistantThreadExample state="onemogućeno" />,
} satisfies Record<CatalogState, () => React.ReactNode>;
