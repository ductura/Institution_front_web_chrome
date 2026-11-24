import { splitIntoChunks, type Chunk } from "./chunks";
import { pickVoice, READ_ALOUD_LANG, readAloudSupported, type ReadAloudHost, type SpeechUtteranceLike } from "./support";

export const READ_ALOUD_MIN_RATE = 0.75;
export const READ_ALOUD_MAX_RATE = 1.5;
export const READ_ALOUD_DEFAULT_RATE = 1;

/** Speed multiplier of the voice: 0.75 to 1.5. */
export type ReadAloudRate = number;

export const clampRate = (rate: number): ReadAloudRate =>
  Number.isFinite(rate) ? Math.min(READ_ALOUD_MAX_RATE, Math.max(READ_ALOUD_MIN_RATE, rate)) : READ_ALOUD_DEFAULT_RATE;

export type ReadAloudState = "unsupported" | "idle" | "reading" | "paused";

export type ReadAloudCallbacks = {
  /** A chunk starts: `index` in the queue, `chunk` carries offsets into the text passed to `start` (for highlighting). */
  onChunkStart?: (chunk: Chunk, index: number) => void;
  onChunkEnd?: (chunk: Chunk, index: number) => void;
  onStateChange?: (state: ReadAloudState) => void;
  /** Reading ended on its own or was stopped. */
  onFinish?: (reason: "completed" | "stopped" | "failed") => void;
};

export type ReadAloudController = {
  readonly state: ReadAloudState;
  /** True when no hr-HR voice exists and the default voice is used (the UI shows a note). Known after `start`. */
  readonly voiceFallback: boolean;
  /** Returns false (and speaks nothing) when unsupported or the text is empty. Replaces any reading in progress. */
  start(text: string): boolean;
  pause(): void;
  resume(): void;
  stop(): void;
  setRate(rate: number): void;
  readonly rate: ReadAloudRate;
};

export function createReadAloud(
  callbacks: ReadAloudCallbacks = {},
  host: ReadAloudHost = globalThis as ReadAloudHost,
  initialRate: number = READ_ALOUD_DEFAULT_RATE,
): ReadAloudController {
  const supported = readAloudSupported(host);
  let state: ReadAloudState = supported ? "idle" : "unsupported";
  let rate = clampRate(initialRate);
  let voiceFallback = false;
  let queue: Chunk[] = [];
  let index = 0;
  let generation = 0;

  const setState = (next: ReadAloudState) => {
    if (state === next) return;
    state = next;
    callbacks.onStateChange?.(next);
  };

  const finish = (reason: "completed" | "stopped" | "failed") => {
    generation += 1;
    queue = [];
    index = 0;
    setState(supported ? "idle" : "unsupported");
    callbacks.onFinish?.(reason);
  };

  function speakCurrent(): void {
    const synth = host.speechSynthesis;
    const Utterance = host.SpeechSynthesisUtterance;
    const chunk = queue[index];
    if (!synth || !Utterance || !chunk) return finish("completed");
    const mine = generation;
    const utterance: SpeechUtteranceLike = new Utterance(chunk.text);
    utterance.lang = READ_ALOUD_LANG;
    utterance.rate = rate;
    const { voice, fallback } = pickVoice(synth.getVoices());
    voiceFallback = fallback;
    if (voice) utterance.voice = voice;
    utterance.onstart = () => { if (mine === generation) callbacks.onChunkStart?.(chunk, index); };
    utterance.onend = () => {
      if (mine !== generation) return; // cancelled or replaced: the old reading must stay silent
      callbacks.onChunkEnd?.(chunk, index);
      index += 1;
      if (index >= queue.length) finish("completed");
      else speakCurrent();
    };
    utterance.onerror = () => { if (mine === generation) finish("failed"); };
    synth.speak(utterance);
  }

  return {
    get state() { return state; },
    get voiceFallback() { return voiceFallback; },
    get rate() { return rate; },
    start(text) {
      if (!supported) return false;
      const chunks = splitIntoChunks(text);
      if (chunks.length === 0) return false;
      generation += 1; // invalidates callbacks of the previous reading
      host.speechSynthesis?.cancel();
      queue = chunks;
      index = 0;
      setState("reading");
      speakCurrent();
      return true;
    },
    pause() {
      if (state !== "reading") return;
      host.speechSynthesis?.pause();
      setState("paused");
    },
    resume() {
      if (state !== "paused") return;
      host.speechSynthesis?.resume();
      setState("reading");
    },
    stop() {
      if (state !== "reading" && state !== "paused") return;
      generation += 1;
      host.speechSynthesis?.cancel();
      finish("stopped");
    },
    setRate(next) { rate = clampRate(next); }, // applies from the next chunk
  };
}
