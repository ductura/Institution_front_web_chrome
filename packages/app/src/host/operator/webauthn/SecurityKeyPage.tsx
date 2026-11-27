"use client";

import { Button, Card } from "@ductura/ui";
import { useState } from "react";

import { useHost } from "../../context";
import { securityKeyMessages as t } from "./messages.hr";
import { confirmWithKey, registerKey, type CeremonyResult } from "./read";

type Shown = { which: "register" | "confirm"; result: CeremonyResult } | null;

const text = (which: "register" | "confirm", result: CeremonyResult): string => {
  if (result.kind === "done") return which === "register" ? t.registered : t.confirmed;
  return { unsupported: t.unsupported, cancelled: t.cancelled, "no-key": t.noKey, already: t.already, denied: t.denied, rejected: t.rejected, replay: t.replay, unavailable: t.unavailable }[result.kind];
};

/** F4-PM2-R16: add and use a security key. The result is shown only after the server's answer; one ceremony at a time. */
export default function SecurityKeyPage() {
  const { role } = useHost();
  const [busy, setBusy] = useState<"register" | "confirm" | null>(null);
  const [shown, setShown] = useState<Shown>(null);

  async function run(which: "register" | "confirm") {
    setBusy(which);
    setShown(null);
    const result = await (which === "register" ? registerKey() : confirmWithKey());
    setBusy(null);
    setShown({ which, result });
  }

  return (
    <section className="page" data-role={role ?? undefined} data-e2="webauthn">
      <h1>{t.title}</h1>
      <p>{t.lead}</p>
      {busy !== null && <p role="status">{t.working}</p>}
      {shown !== null && <p role={shown.result.kind === "done" ? "status" : "alert"}>{text(shown.which, shown.result)}</p>}
      <Card title={t.registerTitle} level={2}>
        <p>{t.registerBody}</p>
        <Button busy={busy !== null} onClick={() => void run("register")}>{t.register}</Button>
      </Card>
      <Card title={t.confirmTitle} level={2}>
        <p>{t.confirmBody}</p>
        <Button tone="secondary" busy={busy !== null} onClick={() => void run("confirm")}>{t.confirm}</Button>
      </Card>
    </section>
  );
}
