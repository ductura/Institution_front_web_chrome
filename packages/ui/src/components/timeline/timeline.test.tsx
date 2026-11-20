import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";

import { Timeline } from "./Timeline";

const onChange = () => undefined;

it("offers a labelled native slider with a position a screen reader can announce", () => {
  const html = renderToStaticMarkup(<Timeline total={4} value={2} onChange={onChange} />);
  expect(html).toContain('type="range"');
  expect(html).toContain('aria-label="Korak nastanka"');
  expect(html).toContain('aria-valuetext="Korak 2 od 4"');
  expect(html).toContain('min="0" max="4"');
});

it("describes an empty recording and clamps a selection from a longer recording", () => {
  const empty = renderToStaticMarkup(<Timeline total={0} value={0} onChange={onChange} />);
  expect(empty).toContain("Nema koraka za reprodukciju.");
  expect(empty).not.toContain('type="range"');
  const shorter = renderToStaticMarkup(<Timeline total={1} value={4} onChange={onChange} />);
  expect(shorter).toContain('aria-valuetext="Korak 1 od 1"');
});
