"use client";

import { EditorOnboarding, editorOnboardingMessages } from "@ductura/ui";
import { useRef, useState } from "react";

import { useEditorOnboarding } from "../../../../packages/app/src/host/student/onboarding/useEditorOnboarding";
import { editorHelpHr } from "../../../lib/i18n/messages.hr";
import ToolbarMenu, { type MenuItem } from "../ToolbarMenu";
import type { EditorHelpView } from "./EditorHelp";

const views = {
  writing: editorHelpHr.writing,
  firstSentence: editorHelpHr.firstSentence,
  recorded: editorHelpHr.recorded,
};
const items: MenuItem[] = Object.entries(views).map(([key, label]) => ({ key, label, checked: false, role: "menuitem" }));

export function EditorHelpMenu({ onSelect }: { onSelect: (view: EditorHelpView) => void }) {
  const [open, setOpen] = useState(false);
  const menu = useRef<HTMLDivElement>(null);
  const onboarding = useEditorOnboarding();
  const t = editorOnboardingMessages[onboarding.locale];
  const guide = { key: "onboarding", label: t.title, checked: false, role: "menuitem" } as const;
  return <>
    <div ref={menu}>
      <ToolbarMenu label={t.help} menuLabel={t.help} items={[guide, ...items]} roving="editor-help" tabIndex={0}
        open={open} onOpenChange={setOpen} onSelect={(key) => {
          if (key === "onboarding") onboarding.openFromHelp();
          else if (Object.hasOwn(views, key)) onSelect(key as EditorHelpView);
          return "close-return";
        }} />
    </div>
    <EditorOnboarding locale={onboarding.locale} mode={onboarding.mode} onClose={() => {
      onboarding.close();
      menu.current?.querySelector<HTMLButtonElement>("button")?.focus();
    }} />
  </>;
}
