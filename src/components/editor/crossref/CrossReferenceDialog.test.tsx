import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";

import { CrossReferenceDialog } from "./CrossReferenceDialog";

const reference = { kind: "heading", id: "demo-chapter" } as const;
const read = { mode: "read", reference, onFollow() {}, onClose() {} } as const;

it("shows the target's current number after it moves", () => {
  const html = renderToStaticMarkup(<CrossReferenceDialog {...read}
    targets={[{ ...reference, number: "2.3", title: "Izmišljeno poglavlje" }]} />);
  expect(html).toContain("Poglavlje 2.3 Izmišljeno poglavlje");
  expect(html).toContain("Idi na cilj");
});

it("keeps a broken reference visible and does not follow another target with the same id", () => {
  const html = renderToStaticMarkup(<CrossReferenceDialog {...read}
    targets={[{ ...reference, kind: "table", number: "1", title: "Izmišljena tablica" }]} />);
  expect(html).toContain("Cilj poveznice više nije u radu.");
  expect(html).not.toContain("Idi na cilj");
});
