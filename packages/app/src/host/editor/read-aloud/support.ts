/** Read-aloud support check over the Web Speech API. Everything runs in the browser; nothing is sent anywhere. */
export type SpeechVoice = { lang: string; name: string; voiceURI: string; default?: boolean };

export type SpeechUtteranceLike = {
  lang: string;
  rate: number;
  voice: SpeechVoice | null;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
};

export type SpeechSynthesisLike = {
  speak(utterance: SpeechUtteranceLike): void;
  cancel(): void;
  pause(): void;
  resume(): void;
  getVoices(): SpeechVoice[];
};

export type ReadAloudHost = {
  speechSynthesis?: SpeechSynthesisLike;
  SpeechSynthesisUtterance?: new (text: string) => SpeechUtteranceLike;
};

export const READ_ALOUD_LANG = "hr-HR";

/** Same test as `speechSupport().reading` of the old addon: both the synthesiser and the utterance class must exist. */
export const readAloudSupported = (host: ReadAloudHost = globalThis as ReadAloudHost): boolean =>
  !!(host.speechSynthesis && host.SpeechSynthesisUtterance);

const isCroatian = (voice: SpeechVoice) => /^hr([-_]|$)/i.test(voice.lang);

/** Picks an hr-HR voice when the browser has one; `fallback` tells the UI the default voice is used instead. */
export function pickVoice(voices: readonly SpeechVoice[]): { voice: SpeechVoice | null; fallback: boolean } {
  const exact = voices.find((voice) => voice.lang.replace("_", "-").toLowerCase() === "hr-hr");
  const voice = exact ?? voices.find(isCroatian) ?? null;
  return { voice, fallback: voice === null };
}
