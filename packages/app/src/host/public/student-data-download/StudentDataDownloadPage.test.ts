import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { HostContext } from "../../context";
import { publicPage } from "../../../routes";
import StudentDataDownloadPage, { runDownload, type Download, type Save } from "./StudentDataDownloadPage";

const TOKEN = "IzmisljeniTokenZaProvjeruPristupacnosti_001";
const page = publicPage(`/izvoz-podataka/${TOKEN}`);

describe("StudentDataDownloadPage", () => {
  it("reads nothing before the button is pressed, since the link works once", () => {
    if (page === null) throw new Error("no public route");
    const download = vi.fn<Download>();
    const html = renderToStaticMarkup(
      createElement(HostContext, { value: { base: "/app/web", page, role: null } },
        createElement(StudentDataDownloadPage, { token: TOKEN, download, save: vi.fn<Save>() })),
    );
    expect(html).toContain("<h1>Izvoz mojih podataka</h1>");
    expect(html).toContain("Preuzmi izvoz");
    expect(download).not.toHaveBeenCalled();
  });
});

describe("runDownload", () => {
  it("saves the bytes under the server's name and type, then shows done", async () => {
    const save = vi.fn<Save>();
    const bytes = new Uint8Array([1, 2, 3]).buffer;
    const state = await runDownload(TOKEN, async () => ({ kind: "ready", bytes, filename: "izvoz.zip", type: "application/zip" }), save);
    expect(state).toEqual({ kind: "done" });
    const [blob, name] = save.mock.calls[0] ?? [];
    expect(name).toBe("izvoz.zip");
    expect(blob?.type).toBe("application/zip");
    expect(blob?.size).toBe(3);
  });

  it("a used or expired link is gone and saves nothing", async () => {
    const save = vi.fn<Save>();
    expect(await runDownload(TOKEN, async () => ({ kind: "gone" }), save)).toEqual({ kind: "gone" });
    expect(save).not.toHaveBeenCalled();
  });

  it("an unavailable server is the catalogue text, never a raw code", async () => {
    expect(await runDownload(TOKEN, async () => ({ kind: "unavailable" }), vi.fn())).toEqual({
      kind: "error", message: "Preuzimanje trenutačno nije moguće. Pokušajte ponovno.",
    });
  });
});
