// WEB-2113: the oneAtATime and whileShown tests of src/components/student/Submission.test.ts for the host's own copy.
import { describe, expect, it } from "vitest";

import { oneAtATime, whileShown } from "./work-read";

describe("oneAtATime: a double click sends one request", () => {
  it("drops a call made while the first is on its way, and sends again after it", async () => {
    let sent = 0;
    let release: () => void = () => undefined;
    const send = oneAtATime(() => { sent += 1; return new Promise<string>((done) => { release = () => done("odgovor"); }); });
    const first = send(undefined);
    expect(await send(undefined)).toBeNull();
    expect(sent).toBe(1);
    release();
    expect(await first).toBe("odgovor");
    const third = send(undefined);
    release();
    await third;
    expect(sent).toBe(2);
  });
});

describe("whileShown: an answer after leaving the page is dropped", () => {
  it("follows an answer while the page is shown, and none once it is gone, even mid-request", async () => {
    const shown = { current: true };
    const followed: string[] = [];
    const follow = whileShown(shown, (answer: string) => { followed.push(answer); });
    let release: () => void = () => undefined;
    const send = oneAtATime(() => new Promise<string>((done) => { release = () => done("predano"); }));

    follow(await Promise.resolve("prvi"));
    const pending = send(undefined);
    shown.current = false; // Back while the submission is on its way
    release();
    follow(await pending);
    expect(followed).toEqual(["prvi"]);
  });

  it("never follows the null of a second click", () => {
    const followed: unknown[] = [];
    whileShown({ current: true }, (answer: unknown) => { followed.push(answer); })(null);
    expect(followed).toEqual([]);
  });
});
