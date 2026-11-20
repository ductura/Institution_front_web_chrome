import { isAllowedTrimmedText } from "@/domain/document/forbidden";

/** Prepare a one-paragraph footnote. An empty result means remove in edit mode. */
export function footnoteText(input: string): string | null {
  const text = input.replace(/\r\n|[\r\n\t]/g, " ").replace(/^\p{White_Space}+|\p{White_Space}+$/gu, "");
  return text === "" || isAllowedTrimmedText(text, 2000) ? text : null;
}
