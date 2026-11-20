/** Web Speech API wrappers. Everything runs in the browser; nothing is sent by Ductura. */
type Recognition = {
  lang: string; continuous: boolean; interimResults: boolean;
  onresult: ((event: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void; stop(): void;
};
type SpeechHost = {
  SpeechRecognition?: new () => Recognition;
  webkitSpeechRecognition?: new () => Recognition;
  speechSynthesis?: { speak(utterance: unknown): void; cancel(): void };
  SpeechSynthesisUtterance?: new (text: string) => { lang: string; onend: (() => void) | null; onerror: (() => void) | null };
};

export const speechSupport = (host: SpeechHost = globalThis as SpeechHost) => ({
  dictation: !!(host.SpeechRecognition ?? host.webkitSpeechRecognition),
  reading: !!(host.speechSynthesis && host.SpeechSynthesisUtterance),
});

export type DictationEnd = "ended" | "denied" | "failed";

/** Starts dictation in Croatian; only final phrases reach onText. Returns a stop function. */
export function startDictation(onText: (phrase: string) => void, onEnd: (reason: DictationEnd) => void, host: SpeechHost = globalThis as SpeechHost): (() => void) | null {
  const Ctor = host.SpeechRecognition ?? host.webkitSpeechRecognition;
  if (!Ctor) return null;
  const recognition = new Ctor();
  recognition.lang = "hr-HR";
  recognition.continuous = true;
  recognition.interimResults = false;
  let reason: DictationEnd = "ended";
  recognition.onresult = (event) => {
    for (let i = event.resultIndex; i < event.results.length; i += 1) {
      const result = event.results[i];
      if (result?.isFinal && result[0].transcript.trim()) onText(result[0].transcript.trim());
    }
  };
  recognition.onerror = (event) => { reason = event.error === "not-allowed" || event.error === "service-not-allowed" ? "denied" : event.error === "aborted" || event.error === "no-speech" ? reason : "failed"; };
  recognition.onend = () => onEnd(reason);
  recognition.start();
  return () => recognition.stop();
}

/** Reads text aloud in Croatian, replacing anything already being read. Returns false when there is nothing to read. */
export function readAloud(text: string, onEnd: () => void, host: SpeechHost = globalThis as SpeechHost): boolean {
  const synth = host.speechSynthesis;
  const Utterance = host.SpeechSynthesisUtterance;
  if (!synth || !Utterance || !text.trim()) return false;
  synth.cancel();
  const utterance = new Utterance(text);
  utterance.lang = "hr-HR";
  utterance.onend = onEnd;
  utterance.onerror = onEnd;
  synth.speak(utterance);
  return true;
}

export const stopReading = (host: SpeechHost = globalThis as SpeechHost) => host.speechSynthesis?.cancel();
