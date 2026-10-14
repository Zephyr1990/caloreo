import { speech, startListening, stopListening } from '../lib/speech';
import { Icon } from './Icon';

interface Props {
  target: string;
  /** Current text of the field the dictation is appended to. */
  value: string;
  onText: (text: string) => void;
  idleTitle: string;
  idleHint: string;
}

export function MicPanel({ target, value, onText, idleTitle, idleHint }: Props) {
  const s = speech.value;
  const listening = s.listening && s.target === target;
  const error = s.target === target ? s.error : null;

  return (
    <section class="mic-panel" aria-label="Dyktowanie">
      <div class={listening ? 'mic-ring listening' : 'mic-ring'}>
        <button
          type="button"
          class="mic-btn"
          aria-label={listening ? 'Zakończ nagrywanie' : 'Zacznij mówić'}
          aria-pressed={listening}
          onClick={() => (listening ? void stopListening() : startListening({ target, base: value, onText }))}
        >
          <Icon name={listening ? 'stop' : 'mic'} size={listening ? 22 : 26} />
        </button>
      </div>
      <div class="stack" style={{ gap: '4px', minWidth: 0 }} aria-live="polite">
        <div class="mic-title">{listening ? 'Słucham…' : idleTitle}</div>
        <div class="small" style={{ fontSize: '14px', color: 'var(--ink-secondary)', lineHeight: 1.4 }}>
          {listening ? (s.interim ? `Słyszę: „${s.interim}”` : 'Mów teraz. Dotknij, aby zakończyć.') : idleHint}
        </div>
        {error && (
          <div class="small" style={{ fontSize: '14px', color: 'var(--warn)', fontWeight: 600 }}>
            {error}
          </div>
        )}
      </div>
    </section>
  );
}
