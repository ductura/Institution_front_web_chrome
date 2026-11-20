/**
 * State of the spelling check outside ProseMirror: the on/off switch, the
 * student's dictionary, the words ignored in this work and the dictionary load
 * (WEB-1104). The editor plugin only reads it and repaints when it changes.
 */
import { loadHrSpeller } from "./engine";
import { browserStorage, readSpelling, readWorkIgnored, writeSpelling, writeWorkIgnored } from "./store";
import { lower, type Speller } from "./words";

export type SpellingStatus = "off" | "loading" | "on" | "fail";
type Storage_ = Pick<Storage, "getItem" | "setItem"> | null;

export type SpellingOptions = {
  workId: string;
  load?: () => Promise<Speller>;
  storage?: Storage_;
  /** Author names and glossary terms the check never points at, lower-cased. */
  names?: () => ReadonlySet<string>;
};

export class SpellingController {
  readonly workId: string;
  speller: Speller | null = null;
  private enabled: boolean;
  private failed = false;
  private loadingNow = false;
  private user: Set<string>;
  private work: Set<string>;
  private known: Set<string>;
  private listeners = new Set<() => void>();
  private readonly storage: Storage_;
  private readonly loader: () => Promise<Speller>;
  private readonly namesOf: () => ReadonlySet<string>;

  constructor(o: SpellingOptions) {
    this.workId = o.workId;
    this.storage = o.storage === undefined ? browserStorage() : o.storage;
    this.loader = o.load ?? (() => loadHrSpeller());
    this.namesOf = o.names ?? (() => new Set());
    const s = readSpelling(this.storage);
    this.enabled = s.enabled;
    this.user = new Set(s.user);
    this.work = new Set(readWorkIgnored(this.storage, o.workId));
    this.known = this.merge();
  }

  get status(): SpellingStatus {
    if (!this.enabled) return "off";
    if (this.speller) return "on";
    return this.failed ? "fail" : "loading";
  }
  get isOn(): boolean { return this.status === "on"; }
  get knownWords(): ReadonlySet<string> { return this.known; }
  get names(): ReadonlySet<string> { return this.namesOf(); }
  get userWords(): readonly string[] { return [...this.user]; }
  get workWords(): readonly string[] { return [...this.work]; }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => { this.listeners.delete(fn); };
  }

  /** Starts loading the dictionary if the check is on and it is not loaded. Resolves when settled. */
  async ensureLoaded(): Promise<void> {
    if (!this.enabled || this.speller || this.loadingNow) return;
    this.loadingNow = true;
    this.failed = false;
    this.emit();
    try { this.speller = await this.loader(); }
    catch { this.failed = true; }
    finally { this.loadingNow = false; }
    this.emit();
  }

  setEnabled(on: boolean): void {
    if (on === this.enabled && !this.failed) return;
    this.enabled = on;
    writeSpelling(this.storage, { enabled: on, user: [...this.user] });
    this.emit();
    if (on) void this.ensureLoaded();
  }
  toggle(): void { this.setEnabled(!this.enabled); }

  /** "Dodaj u moj rječnik": for every work of this browser. */
  addToMine(word: string): void {
    this.user.add(lower(word));
    writeSpelling(this.storage, { enabled: this.enabled, user: [...this.user] });
    this.changed();
  }
  /** "Zanemari u ovom radu": only this work. */
  ignoreInWork(word: string): void {
    this.work.add(lower(word));
    writeWorkIgnored(this.storage, this.workId, [...this.work]);
    this.changed();
  }

  private merge(): Set<string> { return new Set([...this.user, ...this.work]); }
  private changed(): void { this.known = this.merge(); this.emit(); }
  private emit(): void { for (const fn of [...this.listeners]) fn(); }
}
