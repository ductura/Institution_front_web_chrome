"use client";

import { useState } from "react";

import { editorHelpHr } from "../../../lib/i18n/messages.hr";
import ToolbarMenu, { type MenuItem } from "../ToolbarMenu";
import type { EditorHelpView } from "./EditorHelp";

const views = {
  writing: editorHelpHr.writing,
  onboarding: editorHelpHr.onboarding,
  firstSentence: editorHelpHr.firstSentence,
  recorded: editorHelpHr.recorded,
};
const items: MenuItem[] = Object.entries(views).map(([key, label]) => ({ key, label, checked: false, role: "menuitem" }));

export function EditorHelpMenu({ onSelect }: { onSelect: (view: EditorHelpView) => void }) {
  const [open, setOpen] = useState(false);
  return <ToolbarMenu label={editorHelpHr.view} menuLabel={editorHelpHr.view} items={items} roving="editor-help" tabIndex={0}
    open={open} onOpenChange={setOpen} onSelect={(key) => {
      if (Object.hasOwn(views, key)) onSelect(key as EditorHelpView);
      return "close-return";
    }} />;
}
