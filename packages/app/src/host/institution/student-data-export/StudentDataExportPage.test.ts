import { describe, expect, it } from "vitest";

import { say } from "./StudentDataExportPage";

describe("say", () => {
  it("gives every refusal its catalogue text", () => {
    expect(say("signedOut")).toBe("Prijava nije valjana. Prijavite se ponovno.");
    expect(say("notFound")).toBe("Student s tom oznakom nije pronađen u ustanovi.");
    expect(say("exists")).toBe("Za ovog studenta već postoji otvoren zahtjev za izvoz.");
    expect(say("stale")).toBe("Zahtjev više ne čeka odobrenje. Popis je ponovno učitan.");
    for (const kind of ["denied", "unavailable", "invalid"] as const) expect(say(kind)).toMatch(/\S/);
  });
});
