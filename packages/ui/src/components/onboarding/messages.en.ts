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
    ["Commands in the text", "Type / at the beginning of a line to open the command list. Use the arrow keys to move through the suggestions and press Enter to choose a command."],
    ["Saving your work", "The editor saves your changes as you write. Check the bottom of the editor to see whether your work is saved on this device or on the server. You can open this guide again from the Help menu."],
  ],
} satisfies typeof onboardingHr;
