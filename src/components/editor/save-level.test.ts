import type { SaveStateName } from "@ductura/ui";
import { describe, expect, it } from "vitest";

import { findForbiddenTerms } from "../../../scripts/forbidden-terms/terms";
import {
  levelAnnouncement, offlineWaitingText, reconnectShown, reconnectText, saveLevelOf, waitingText,
} from "./save-level";

const save = (state: SaveStateName, receiptSigned = false, blocked = false) => ({ state, receiptSigned, blocked });

describe("ED-01c: save level (NF2-P2 a)", () => {
  it("names the level the chip shows, never the server without a signed receipt (B-6)", () => {
    expect(saveLevelOf(save("EDITING"), true)).toBe("device");
    expect(saveLevelOf(save("SAVING_LOCAL"), true)).toBe("device");
    expect(saveLevelOf(save("LOCAL_DURABLE"), true)).toBe("device");
    expect(saveLevelOf(save("SYNCING"), true)).toBe("device");
    expect(saveLevelOf(save("SYNCED"), true)).toBe("device");
    expect(saveLevelOf(save("SYNCED", true), true)).toBe("server");
    expect(saveLevelOf(save("SYNCED", true), undefined)).toBe("server");
    expect(saveLevelOf(save("ERROR"), true)).toBe("error");
    expect(saveLevelOf(save("CONFLICT"), true)).toBe("conflict");
    expect(saveLevelOf(save("CONFLICT"), false)).toBe("conflict");
    expect(saveLevelOf(save("RECOVERY_REQUIRED"), false)).toBe("error");
  });

  it("is offline only below an error, and nothing while no state is claimed", () => {
    expect(saveLevelOf(save("LOCAL_DURABLE"), false)).toBe("offline");
    expect(saveLevelOf(save("SYNCED", true), false)).toBe("offline");
    expect(saveLevelOf(null, true)).toBeNull();
    expect(saveLevelOf(save("LOCAL_DURABLE", false, true), true)).toBeNull();
  });

  it("announces only a change of level, never the first level nor a pause in typing", () => {
    expect(levelAnnouncement(null, "device")).toBeNull();
    expect(levelAnnouncement("device", "device")).toBeNull();
    expect(levelAnnouncement("device", null)).toBeNull();
    expect(levelAnnouncement("device", "server")).toBe("Spremljeno na poslužitelju.");
    expect(levelAnnouncement("server", "device")).toBe("Spremljeno na uređaju.");
    expect(levelAnnouncement("device", "offline")).toBe("Izvan mreže. Tekst se sprema na uređaju.");
    expect(levelAnnouncement("device", "error")).toBe("Slanje je zaustavljeno. Tekst je na uređaju.");
    expect(levelAnnouncement("error", "conflict")).toBe("Sukob: tekst ostaje na uređaju.");
  });
});

describe("ED-01c: what waits to be sent (NF2-P2 b, c)", () => {
  it("counts the changes in Croatian", () => {
    expect(waitingText(1)).toBe("čeka slanje: 1 izmjena");
    expect(waitingText(3)).toBe("čeka slanje: 3 izmjene");
    expect(waitingText(5)).toBe("čeka slanje: 5 izmjena");
    expect(reconnectText(1)).toBe("Šalje se 1 izmjena.");
    expect(reconnectText(2)).toBe("Šalje se 2 izmjene.");
    expect(reconnectText(null)).toBe("Šalje se tekst s ovog uređaja.");
  });

  it("says in the offline notice how many changes wait", () => {
    expect(offlineWaitingText(1)).toBe("Čeka slanje: 1 izmjena.");
    expect(offlineWaitingText(4)).toBe("Čeka slanje: 4 izmjene.");
  });

  it("shows the reconnect message from the return of the network until nothing waits", () => {
    const back = { online: true, pending: 2, settled: false };
    // Comes back with changes waiting.
    expect(reconnectShown(false, false, back)).toBe(true);
    // Stays while they are sent.
    expect(reconnectShown(true, true, back)).toBe(true);
    // Goes once the journal is empty or the receipt is verified; it never says the server.
    expect(reconnectShown(true, true, { online: true, pending: 0, settled: true })).toBe(false);
    // Nothing was waiting: no message.
    expect(reconnectShown(false, false, { online: true, pending: 0, settled: true })).toBe(false);
    // Online all along: no message.
    expect(reconnectShown(false, true, back)).toBe(false);
    // Offline again: the offline notice takes over.
    expect(reconnectShown(true, true, { online: false, pending: 2, settled: false })).toBe(false);
  });

  it("uses no forbidden terms", () => {
    const texts = [waitingText(2), reconnectText(2), reconnectText(null), levelAnnouncement("device", "error") ?? ""];
    expect(findForbiddenTerms(JSON.stringify(texts), "hr")).toEqual([]);
  });
});
