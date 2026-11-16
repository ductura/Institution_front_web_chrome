// Clipboard without permission (web PLAN §6, integration): fakes of the
// browser objects behave as Chrome, Firefox and Safari do when the write is
// refused. Real browsers run these paths in the 2.c6 matrix.
import { describe, expect, it } from "vitest";
import { messagesHr } from "../../locales/hr.ts";
import { permissionState, writeClipboard, type ClipboardScratch, type PlatformEnv } from "./capabilities.ts";

const notAllowed = () => Object.assign(new Error("Write permission denied."), { name: "NotAllowedError" });

function fakeDocument(copyWorks: boolean) {
  const attached: ClipboardScratch[] = [];
  const copied: string[] = [];
  let current: ClipboardScratch | undefined;
  const doc: NonNullable<PlatformEnv["document"]> = {
    createElement: () => {
      const node: ClipboardScratch = { value: "", style: {}, setAttribute() {}, select: () => (current = node) };
      return node;
    },
    body: {
      appendChild: (n) => attached.push(n as ClipboardScratch),
      removeChild: (n) => attached.splice(attached.indexOf(n as ClipboardScratch), 1),
    },
    execCommand: (command) => {
      if (command !== "copy" || !copyWorks || !current) return false;
      copied.push(current.value);
      return true;
    },
  };
  return { doc, attached, copied };
}

describe("writeClipboard without permission", () => {
  it("uses the Clipboard API when it is allowed", async () => {
    const written: string[] = [];
    const env: PlatformEnv = { navigator: { clipboard: { writeText: async (t) => void written.push(t) } } };
    await expect(writeClipboard("Izmišljeni odlomak.", env)).resolves.toEqual({ ok: true, via: "async" });
    expect(written).toEqual(["Izmišljeni odlomak."]);
  });

  it("falls back to the copy command when the write is refused (NotAllowedError)", async () => {
    const { doc, attached, copied } = fakeDocument(true);
    const env: PlatformEnv = { navigator: { clipboard: { writeText: () => Promise.reject(notAllowed()) } }, document: doc };
    await expect(writeClipboard("Izmišljeni odlomak.", env)).resolves.toEqual({ ok: true, via: "exec-command" });
    expect(copied).toEqual(["Izmišljeni odlomak."]);
    expect(attached).toEqual([]);
  });

  it("falls back when writeText throws synchronously (insecure context in some WebViews)", async () => {
    const { doc, copied } = fakeDocument(true);
    const env: PlatformEnv = {
      navigator: {
        clipboard: {
          writeText: () => {
            throw notAllowed();
          },
        },
      },
      document: doc,
    };
    await expect(writeClipboard("Tekst.", env)).resolves.toEqual({ ok: true, via: "exec-command" });
    expect(copied).toEqual(["Tekst."]);
  });

  it("returns the catalogue warning when both ways fail, and removes the scratch node", async () => {
    const { doc, attached } = fakeDocument(false);
    const env: PlatformEnv = { navigator: { clipboard: { writeText: () => Promise.reject(notAllowed()) } }, document: doc };
    const result = await writeClipboard("Tekst.", env);
    expect(result).toEqual({ ok: false, messageKey: "workspace.earlierDraftCopyFailed" });
    expect(messagesHr.workspace.earlierDraftCopyFailed).toBe("Tekst nije moguće staviti u međuspremnik. Izvezite ga kao datoteku.");
    expect(attached).toEqual([]);
  });

  it("returns the warning when the copy command throws", async () => {
    const { doc, attached } = fakeDocument(true);
    doc.execCommand = () => {
      throw new Error("SecurityError");
    };
    await expect(writeClipboard("Tekst.", { document: doc })).resolves.toEqual({
      ok: false,
      messageKey: "workspace.earlierDraftCopyFailed",
    });
    expect(attached).toEqual([]);
  });

  it("keeps a copy that worked when removing the scratch node throws, and gives focus back", async () => {
    const { doc, copied } = fakeDocument(true);
    let focused = 0;
    doc.activeElement = { focus: () => void focused++ };
    doc.body!.removeChild = () => {
      throw new Error("NotFoundError");
    };
    await expect(writeClipboard("Tekst.", { document: doc })).resolves.toEqual({ ok: true, via: "exec-command" });
    expect(copied).toEqual(["Tekst."]);
    expect(focused).toBe(1);
  });

  it("never throws when a getter on the way throws", async () => {
    const throwingNavigator = {
      get navigator(): never {
        throw new Error("SecurityError");
      },
    } as PlatformEnv;
    await expect(writeClipboard("Tekst.", throwingNavigator)).resolves.toMatchObject({ ok: false });
    await expect(permissionState("x", throwingNavigator)).resolves.toBe("unknown");
    const throwingParts = {
      navigator: {
        get clipboard(): never {
          throw new Error("SecurityError");
        },
        get permissions(): never {
          throw new Error("SecurityError");
        },
      },
      document: {
        ...fakeDocument(true).doc,
        get body(): never {
          throw new Error("SecurityError");
        },
      },
    } as PlatformEnv;
    await expect(writeClipboard("Tekst.", throwingParts)).resolves.toMatchObject({ ok: false });
    await expect(permissionState("x", throwingParts)).resolves.toBe("unknown");
  });

  it("returns the warning in an environment with neither", async () => {
    await expect(writeClipboard("Tekst.", {})).resolves.toMatchObject({ ok: false });
  });
});

describe("permissionState", () => {
  it("passes the three states through", async () => {
    for (const state of ["granted", "denied", "prompt"] as const) {
      await expect(permissionState("clipboard-write", { navigator: { permissions: { query: async () => ({ state }) } } })).resolves.toBe(state);
    }
  });

  it("is unknown without the Permissions API (older Safari)", async () => {
    await expect(permissionState("clipboard-write", { navigator: {} })).resolves.toBe("unknown");
  });

  it("is unknown when the name is rejected (Firefox and clipboard-write)", async () => {
    const env: PlatformEnv = { navigator: { permissions: { query: () => Promise.reject(new TypeError("not a valid PermissionName")) } } };
    await expect(permissionState("clipboard-write", env)).resolves.toBe("unknown");
  });

  it("is unknown for an answer outside the three states or a query that throws", async () => {
    await expect(permissionState("x", { navigator: { permissions: { query: async () => ({ state: "weird" }) } } })).resolves.toBe("unknown");
    const throwingQuery: PlatformEnv = {
      navigator: {
        permissions: {
          query: () => {
            throw new Error("boom");
          },
        },
      },
    };
    await expect(permissionState("x", throwingQuery)).resolves.toBe("unknown");
  });
});
