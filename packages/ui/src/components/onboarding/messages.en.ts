import type { onboardingHr } from "./messages.hr";

export const onboardingEn = {
  help: "Help",
  title: "Getting started",
  duration: "About 2 minutes",
  progress: "Step {step} of {total}",
  previous: "Back",
  next: "Next",
  skip: "Skip guide",
  finish: "Finish guide",
  steps: [
    ["Writing and formatting", "Write on the page. Use the toolbar above it to choose a paragraph style or heading, format selected text, and undo your last edit."],
    ["Citations and commands", "Type @ and the first letters of an author's surname to cite a source from your bibliography. Type / for commands such as inserting a table or a footnote."],
    ["Saving your work", "Changes are saved as you write. Check the bottom of the editor to see whether your work is saved on this device or on the server. You can open this guide again from the Help menu."],
  ],
} satisfies typeof onboardingHr;
