import { signal } from '@preact/signals';

/*
 * Speech-to-text through the browser's Web Speech API (Safari exposes it as
 * webkitSpeechRecognition). The recognizer lives at module level so it can be started
 * in the tap handler on one screen (browsers require a user gesture) and keep feeding
 * text to the next screen.
 */

interface RecognitionAlternative {
  transcript: string;
}
interface RecognitionResult {
  readonly isFinal: boolean;
  readonly length: number;
  [index: number]: RecognitionAlternative;
}
interface RecognitionResultList {
  readonly length: number;
  [index: number]: RecognitionResult;
}
interface RecognitionEvent {
  readonly results: RecognitionResultList;
}
interface RecognitionErrorEvent {
  readonly error: string;
}
interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((e: RecognitionEvent) => void) | null;
  onerror: ((e: RecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type RecognitionCtor = new () => Recognition;

function recognitionCtor(): RecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function speechSupported(): boolean {
  return recognitionCtor() !== null;
}

export interface SpeechState {
  listening: boolean;
  /** Which field the recognizer writes to (or last wrote to, for errors). */
  target: string | null;
  /** Words heard but not yet final. */
  interim: string;
  error: string | null;
}

export const speech = signal<SpeechState>({ listening: false, target: null, interim: '', error: null });

/** Appends dictated text to what was already in the field. */
export function joinText(base: string, added: string): string {
  const a = added.trim();
  const b = base.trimEnd();
  if (!a) return b;
  return b ? `${b} ${a}` : a;
}

/**
 * Builds the text from all results of a session. Some engines repeat everything said so
 * far in each final result; such repeats replace the text instead of being appended.
 */
export function collectTranscript(results: readonly { isFinal: boolean; transcript: string }[]): {
  final: string;
  interim: string;
} {
  let final = '';
  let interim = '';
  for (const r of results) {
    const t = r.transcript.trim();
    if (!t) continue;
    if (r.isFinal) {
      final = final && t.toLowerCase().startsWith(final.toLowerCase()) ? t : joinText(final, t);
    } else {
      interim = joinText(interim, t);
    }
  }
  return { final, interim };
}

export function speechErrorMessage(code: string): string | null {
  switch (code) {
    case 'aborted':
      return null;
    case 'no-speech':
      return 'Nic nie usłyszałem. Spróbuj jeszcze raz.';
    case 'not-allowed':
    case 'service-not-allowed':
      return 'Brak zgody na mikrofon lub rozpoznawanie mowy. Sprawdź ustawienia albo użyj mikrofonu na klawiaturze iOS.';
    case 'audio-capture':
      return 'Nie udało się użyć mikrofonu.';
    case 'network':
      return 'Rozpoznawanie mowy wymaga internetu.';
    case 'language-not-supported':
      return 'Rozpoznawanie mowy po polsku nie jest dostępne na tym urządzeniu.';
    default:
      return `Rozpoznawanie mowy nie zadziałało (${code}).`;
  }
}

export const UNSUPPORTED_MESSAGE =
  'Ta przeglądarka nie obsługuje rozpoznawania mowy. Użyj mikrofonu na klawiaturze iOS (dyktowanie).';

let active: Recognition | null = null;
let ended: (() => void) | null = null;

export interface ListenOptions {
  target: string;
  /** Text already in the field; dictated words are appended to it. */
  base: string;
  onText: (text: string) => void;
  lang?: string;
}

/** Starts dictation. Call from a tap handler. Returns false when it could not start. */
export function startListening(opts: ListenOptions): boolean {
  active?.abort();
  active = null;
  const Ctor = recognitionCtor();
  if (!Ctor) {
    speech.value = { listening: false, target: opts.target, interim: '', error: UNSUPPORTED_MESSAGE };
    return false;
  }
  const rec = new Ctor();
  rec.lang = opts.lang ?? 'pl-PL';
  rec.continuous = true;
  rec.interimResults = true;
  rec.maxAlternatives = 1;

  rec.onresult = (e) => {
    if (active !== rec) return;
    const list = Array.from({ length: e.results.length }, (_, i) => ({
      isFinal: e.results[i].isFinal,
      transcript: e.results[i][0]?.transcript ?? '',
    }));
    const { final, interim } = collectTranscript(list);
    opts.onText(joinText(opts.base, final));
    speech.value = { ...speech.value, interim };
  };
  rec.onerror = (e) => {
    if (active !== rec) return;
    const message = speechErrorMessage(e.error);
    if (message) speech.value = { ...speech.value, error: message };
  };
  rec.onend = () => {
    if (active === rec) {
      active = null;
      speech.value = { ...speech.value, listening: false, interim: '' };
    }
    ended?.();
    ended = null;
  };

  try {
    rec.start();
  } catch {
    speech.value = { listening: false, target: opts.target, interim: '', error: 'Nie udało się uruchomić rozpoznawania mowy.' };
    return false;
  }
  active = rec;
  speech.value = { listening: true, target: opts.target, interim: '', error: null };
  return true;
}

/** Stops dictation and resolves when the last words have arrived (or after a short wait). */
export function stopListening(): Promise<void> {
  if (!active) return Promise.resolve();
  const rec = active;
  return new Promise((resolve) => {
    const timer = setTimeout(done, 1500);
    function done() {
      clearTimeout(timer);
      resolve();
    }
    ended = done;
    rec.stop();
  });
}

/** Stops dictation immediately, dropping words not yet recognized. */
export function cancelListening(): void {
  const rec = active;
  active = null;
  rec?.abort();
  speech.value = { listening: false, target: null, interim: '', error: null };
}

export function clearSpeechError(): void {
  if (speech.value.error) speech.value = { ...speech.value, error: null };
}
