import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";

import { Fingerprint } from "./index";

it("shows sixteen groups of four hex characters and a named copy button", () => {
  const value = "0123456789ABCDEF".repeat(4);
  const markup = renderToStaticMarkup(<Fingerprint value={value} />);
  const groups = [...markup.matchAll(/<span>([0-9A-F]{4})<\/span>/g)].map((match) => match[1]);
  expect(groups).toHaveLength(16);
  expect(groups.join("")).toBe(value);
  expect(markup).toMatch(/<button[^>]*>Otisak u međuspremnik<\/button>/);
});

it("without the digest keeps only the copy button (design alignment 27. 11. 2026.)", () => {
  const value = "0123456789abcdef".repeat(4);
  const markup = renderToStaticMarkup(<Fingerprint value={value} showDigest={false} />);
  expect(markup).not.toContain("<code");
  expect(markup).not.toContain("0123");
  expect(markup).toMatch(/<button[^>]*>Otisak u međuspremnik<\/button>/);
});

it.each(["f".repeat(63), "f".repeat(65), "f".repeat(63) + "\n", "g".repeat(64)])(
  "omits the copy control when the value is not a 64-character hexadecimal digest (%j)",
  (value) => expect(renderToStaticMarkup(<Fingerprint value={value} />)).toBe(""),
);
