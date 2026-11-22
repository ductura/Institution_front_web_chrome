// @vitest-environment jsdom
import axe from "axe-core";
import { act, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  StudentDataDownload, StudentDataExportList, StudentDataExportRequest,
  type ExportRow, type StudentDataDownloadLabels, type StudentDataExportLabels,
} from "./StudentDataExport";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const labels: StudentDataExportLabels = {
  requestTitle: "Zahtjev za izvoz podataka", requestLead: "Referada predaje zahtjev.", studentId: "Oznaka studenta",
  studentIdHint: "Oznaka iz popisa korisnika.", studentIdMissing: "Upišite valjanu oznaku studenta.",
  identityDocument: "Isprava", identityDocumentPick: "Odaberite ispravu", identityDocumentMissing: "Odaberite ispravu.",
  documents: { identity_card: "Osobna iskaznica", passport: "Putovnica", student_card: "Studentska iskaznica" },
  identityConfirmed: "Provjerio/la sam identitet studenta", identityNotConfirmed: "Potvrdite provjeru identiteta.",
  note: "Napomena", noteHint: "Do 80 znakova.", noteMissing: "Upišite napomenu.", request: "Pošalji zahtjev", requesting: "Šaljem…",
  listTitle: "Zahtjevi za izvoz", listLead: "Administrator pokreće izvoz.", empty: "Nema zahtjeva.", loading: "Učitavanje…", retry: "Pokušaj ponovno",
  states: { requested: "Zatražen", approved: "Odobren", ready: "Spreman", downloaded: "Preuzet", expired: "Istekao" },
  requestedAt: (at) => `Zatraženo: ${at}`, expiresAt: (at) => `Poveznica vrijedi do: ${at}`,
  approve: "Pokreni izvoz", approveTitle: "Pokretanje izvoza", reference: "Urudžbeni broj", referenceHint: "Upisuje se u zapis.",
  referenceMissing: "Upišite urudžbeni broj.", approving: "Pokrećem…", cancel: "Odustani",
};
const download: StudentDataDownloadLabels = {
  title: "Izvoz mojih podataka", lead: "Poveznica vrijedi jednom.", download: "Preuzmi izvoz", downloading: "Preuzimam…",
  done: "Izvoz je preuzet.", gone: "Poveznica je već iskorištena ili je istekla",
};
const STUDENT = "c1302000-0000-4000-8000-000000000001";
const row = (over: Partial<ExportRow>): ExportRow => ({
  exportId: "e1302000-0000-4000-8000-000000000001", state: "requested", requestedAt: "21. 11. 2026. 10:00", expiresAt: null, ...over,
});

let root: Root | undefined;
let host: HTMLElement | undefined;
function mount(element: ReactElement) {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  act(() => root!.render(element));
  return host;
}
afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  root = undefined;
});
const violations = async (el: Element) => (await axe.run(el, { rules: { region: { enabled: false }, "color-contrast": { enabled: false } } })).violations.map((x) => x.id);
const control = (el: HTMLElement, label: string) => {
  const found = [...el.querySelectorAll("label")].find((l) => l.textContent === label)!;
  return document.getElementById(found.htmlFor) as HTMLInputElement | HTMLSelectElement;
};
function set(f: HTMLInputElement | HTMLSelectElement, value: string) {
  const proto = f instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
  act(() => {
    Object.getOwnPropertyDescriptor(proto, "value")!.set!.call(f, value);
    f.dispatchEvent(new Event(f instanceof HTMLSelectElement ? "change" : "input", { bubbles: true }));
  });
}
const button = (el: HTMLElement, name: string) => [...el.querySelectorAll("button")].find((b) => b.textContent === name);

describe("StudentDataExportRequest", () => {
  it("has labelled fields and no approve button (axe clean)", async () => {
    const el = mount(<StudentDataExportRequest labels={labels} onRequest={() => undefined} />);
    expect(control(el, "Oznaka studenta")).toBeTruthy();
    expect(control(el, "Isprava")).toBeTruthy();
    expect(button(el, "Pokreni izvoz")).toBeUndefined();
    expect(await violations(el)).toEqual([]);
  });

  it("asks for every field and the identity confirmation before sending", () => {
    const onRequest = vi.fn();
    const el = mount(<StudentDataExportRequest labels={labels} onRequest={onRequest} />);
    act(() => el.querySelector("form")!.requestSubmit());
    expect(onRequest).not.toHaveBeenCalled();
    for (const text of [labels.studentIdMissing, labels.identityDocumentMissing, labels.identityNotConfirmed, labels.noteMissing]) {
      expect(el.textContent).toContain(text);
    }
  });

  it("sends the trimmed, lower-case student and the checked document once confirmed", () => {
    const onRequest = vi.fn();
    const el = mount(<StudentDataExportRequest labels={labels} onRequest={onRequest} />);
    set(control(el, "Oznaka studenta"), ` ${STUDENT.toUpperCase()} `);
    set(control(el, "Isprava"), "passport");
    set(control(el, "Napomena"), "  Izmišljeni zahtjev  ");
    act(() => el.querySelector("form")!.requestSubmit());
    expect(onRequest).not.toHaveBeenCalled();
    act(() => (control(el, labels.identityConfirmed) as HTMLInputElement).click());
    act(() => el.querySelector("form")!.requestSubmit());
    expect(onRequest).toHaveBeenCalledWith({ studentId: STUDENT, identityCheckedBy: "passport", note: "Izmišljeni zahtjev" });
  });

  it("shows a refused request as an alert", () => {
    const el = mount(<StudentDataExportRequest labels={labels} onRequest={() => undefined} actionError="Zahtjev za ovog studenta već postoji." />);
    expect(el.querySelector("[role=alert]")!.textContent).toBe("Zahtjev za ovog studenta već postoji.");
  });
});

describe("StudentDataExportList", () => {
  const rows = [
    row({}),
    row({ exportId: "e1302000-0000-4000-8000-000000000002", state: "ready", expiresAt: "28. 11. 2026. 10:00" }),
    row({ exportId: "e1302000-0000-4000-8000-000000000003", state: "expired", expiresAt: "1. 11. 2026. 10:00" }),
  ];

  it("names each state as a word, shows the expiry as a time and has no request form (axe clean)", async () => {
    const el = mount(<StudentDataExportList labels={labels} state={{ kind: "ready", exports: rows }} onApprove={() => undefined} />);
    const items = [...el.querySelectorAll("li")];
    expect(items.map((li) => li.querySelector("p")!.textContent)).toEqual(["Zatražen", "Spreman", "Istekao"]);
    expect(items[1]!.textContent).toContain("Poveznica vrijedi do: 28. 11. 2026. 10:00");
    expect(items[0]!.textContent).not.toContain("Poveznica vrijedi do");
    expect(el.querySelector("form")).toBeNull();
    expect(button(el, "Pošalji zahtjev")).toBeUndefined();
    expect(await violations(el)).toEqual([]);
  });

  it("offers Pokreni izvoz only on a waiting request and asks for the reference first", () => {
    const onApprove = vi.fn();
    const el = mount(<StudentDataExportList labels={labels} state={{ kind: "ready", exports: rows }} onApprove={onApprove} />);
    expect([...el.querySelectorAll("button")].filter((b) => b.textContent === "Pokreni izvoz")).toHaveLength(1);
    act(() => button(el, "Pokreni izvoz")!.click());
    act(() => el.querySelector("form")!.requestSubmit());
    expect(onApprove).not.toHaveBeenCalled();
    expect(el.textContent).toContain(labels.referenceMissing);
    set(control(el, "Urudžbeni broj"), " IZM-2026-7 ");
    act(() => el.querySelector("form")!.requestSubmit());
    expect(onApprove).toHaveBeenCalledWith(rows[0]!.exportId, "IZM-2026-7");
  });

  it("shows loading, the empty list and an error with a retry", () => {
    const onRetry = vi.fn();
    const el = mount(<StudentDataExportList labels={labels} state={{ kind: "loading" }} onApprove={() => undefined} />);
    expect(el.querySelector("[role=status]")!.textContent).toBe(labels.loading);
    act(() => root!.render(<StudentDataExportList labels={labels} state={{ kind: "ready", exports: [] }} onApprove={() => undefined} />));
    expect(el.textContent).toContain(labels.empty);
    act(() => root!.render(<StudentDataExportList labels={labels} state={{ kind: "error", message: "Nemate ovlast." }} onApprove={() => undefined} onRetry={onRetry} />));
    expect(el.querySelector("[role=alert]")!.textContent).toBe("Nemate ovlast.");
    act(() => button(el, labels.retry)!.click());
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});

describe("StudentDataDownload", () => {
  it("reads nothing until the student presses the button (axe clean)", async () => {
    const onDownload = vi.fn();
    const el = mount(<StudentDataDownload labels={download} state={{ kind: "idle" }} onDownload={onDownload} />);
    expect(onDownload).not.toHaveBeenCalled();
    act(() => button(el, download.download)!.click());
    expect(onDownload).toHaveBeenCalledTimes(1);
    expect(await violations(el)).toEqual([]);
  });

  it("says the link was used or expired after a 410 and offers no button", () => {
    const el = mount(<StudentDataDownload labels={download} state={{ kind: "gone" }} onDownload={() => undefined} />);
    expect(el.querySelector("[role=alert]")!.textContent).toBe("Poveznica je već iskorištena ili je istekla");
    expect(el.querySelector("button")).toBeNull();
  });

  it("does not call twice while busy", () => {
    const onDownload = vi.fn();
    const el = mount(<StudentDataDownload labels={download} state={{ kind: "busy" }} onDownload={onDownload} />);
    act(() => el.querySelector("button")!.click());
    expect(onDownload).not.toHaveBeenCalled();
  });
});
