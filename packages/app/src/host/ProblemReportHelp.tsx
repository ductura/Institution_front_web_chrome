"use client";

import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { Button, Dialog, ProblemReportForm } from "@ductura/ui";

import { createApi } from "../../../../src/client/api.ts";
import { sendProblemReport, type ProblemReportCall } from "../../../../src/components/support/problem-report-send.ts";
import { PROBLEM_REPORT_CATEGORIES } from "../../../../src/components/support/index.ts";
import { INITIAL_FORM, createSender, formView, scheduleUnlock, type FormState } from "../../../../src/components/support/index.ts";

import { useLocale } from "../i18n";

const APP_VERSION = "0.1.0";

/**
 * The transport of "Prijavi problem". TODO(ugovor): support.problem-report.post
 * is not in the published contract, so the generated client refuses it before
 * any request (status 0) and the form says so with its kept-description text.
 * The transport is the client's own; no-direct-api keeps every call in src/client.
 */
const call: ProblemReportCall = async (id, input) => {
  const api = createApi() as unknown as (id: string, input: unknown) => Promise<{ ok: boolean; status: number; body?: unknown }>;
  const answer = await api(id, input);
  return answer.ok ? { ok: true, status: answer.status, body: answer.body } : { ok: false, status: answer.status, body: answer.body };
};

/** "Prijavi problem" in the help place of the shell: a button and a modal dialog (WEB-1806, M11.10). */
export default function ProblemReportHelp({ triggerClass }: { triggerClass?: string }) {
  const { t } = useLocale();
  const s = t.support;
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<FormState>(INITIAL_FORM);
  const [now, setNow] = useState(() => Date.now());
  const sender = useRef<ReturnType<typeof createSender> | null>(null);
  sender.current ??= createSender((body) => sendProblemReport(call, body, Date.now()));

  const view = useMemo(() => formView(state, now), [state, now]);
  const context = { appVersion: APP_VERSION, pathname, syncState: null, userAgent: navigator.userAgent };

  const submit = async () => {
    const next = await sender.current!(state, Date.now(), context, setState);
    setState(next);
  };
  // After a 429 the button stays locked until the retry time, then the form is drawn again.
  useEffect(
    () => scheduleUnlock(state.step, Date.now(), (run, ms) => window.setTimeout(run, ms), window.clearTimeout, () => setNow(Date.now())),
    [state.step],
  );
  const close = () => {
    setOpen(false);
    if (state.step.kind === "sent" || state.step.kind === "ended") setState(INITIAL_FORM);
  };
  const category = (value: string) => {
    if ((PROBLEM_REPORT_CATEGORIES as readonly string[]).includes(value)) setState({ ...state, category: value as FormState["category"] });
  };

  return (
    <>
      <button type="button" className={triggerClass} onClick={() => setOpen(true)}>
        {s.open}
      </button>
      <Dialog open={open} title={s.title} onClose={close} actions={<Button type="button" onClick={close}>{s.close}</Button>}>
        <ProblemReportForm
          view={view}
          labels={{
            intro: s.intro, categoryLegend: s.categoryLegend, description: s.description, attachedTitle: s.attachedTitle,
            attached: [s.attachedPage, s.attachedBrowser, s.attachedVersion.replace("{version}", APP_VERSION)], noContent: s.noContent,
          }}
          description={state.description}
          onDescription={(description) => setState({ ...state, description })}
          onCategory={category}
          onSubmit={() => void submit()}
        />
      </Dialog>
    </>
  );
}
