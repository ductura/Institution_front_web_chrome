import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";

import { SaveStatus } from "./SaveStatus";

it.each([
  ["LOCAL_DURABLE", true, "Spremljeno na uređaju"],
  ["SYNCED", true, "Spremljeno na poslužitelju"],
  ["SAVING_LOCAL", true, "Sprema se…"],
  ["SYNCING", true, "Sprema se…"],
  ["ERROR", true, "Nije spremljeno na uređaju"],
  ["LOCAL_DURABLE", false, "Izvan mreže · Spremljeno na uređaju"],
  ["ERROR", false, "Izvan mreže · Nije spremljeno na uređaju"],
  ["RECOVERY_REQUIRED", false, "Izvan mreže · Potreban oporavak"],
] as const)("%s when online is %s has a qualified live label", (state, online, label) => {
  const html = renderToStaticMarkup(<SaveStatus state={state} online={online} />);
  expect(html).toContain('role="status"');
  expect(html).toContain(`>${label}</span>`);
});

it("a blocked tab never claims a save", () => {
  const html = renderToStaticMarkup(<SaveStatus state="SYNCED" blocked />);
  expect(html).toContain("Dokument je otvoren u drugoj kartici.");
  expect(html).not.toContain("Spremljeno");
});

it("live=false shows the same chip without a live region", () => {
  const html = renderToStaticMarkup(<SaveStatus state="SAVING_LOCAL" live={false} />);
  expect(html).not.toContain('role="status"');
  expect(html).not.toContain("aria-live");
  expect(html).toContain(">Sprema se…</span>");
});

it("offline, it adds what waits to be sent after the label", () => {
  const html = renderToStaticMarkup(<SaveStatus state="LOCAL_DURABLE" online={false} waiting="čeka slanje: 2 izmjene" />);
  expect(html).toContain(">Izvan mreže · Spremljeno na uređaju · čeka slanje: 2 izmjene</span>");
  const online = renderToStaticMarkup(<SaveStatus state="LOCAL_DURABLE" waiting="čeka slanje: 2 izmjene" />);
  expect(online).not.toContain("čeka slanje");
});
