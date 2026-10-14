import { useState } from 'preact/hooks';

/** Parses user input like "150", "12,5" or "12.5". Returns null for empty or invalid input. */
export function parseNumber(text: string): number | null {
  const t = text.trim().replace(',', '.');
  if (t === '') return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export function formatForInput(value: number, decimals: 0 | 1): string {
  if (!Number.isFinite(value)) return '';
  if (decimals === 0) return String(Math.round(value));
  const r = Math.round(value * 10) / 10;
  return String(r).replace('.', ',');
}

interface Props {
  id: string;
  value: number;
  decimals?: 0 | 1;
  /** Called on every valid edit; empty or invalid input is ignored. */
  onValue: (n: number) => void;
  onFocus?: () => void;
  label?: string;
}

/** Text input for non-negative numbers. Keeps the raw text while editing so "12," is not lost. */
export function NumberField({ id, value, decimals = 0, onValue, onFocus, label }: Props) {
  const [text, setText] = useState<string | null>(null);
  return (
    <input
      id={id}
      class="input compact"
      type="text"
      inputMode="decimal"
      autoComplete="off"
      aria-label={label}
      value={text ?? formatForInput(value, decimals)}
      onFocus={(e) => {
        setText(formatForInput(value, decimals));
        onFocus?.();
        e.currentTarget.select();
      }}
      onInput={(e) => {
        const t = e.currentTarget.value;
        setText(t);
        const n = parseNumber(t);
        if (n !== null) onValue(n);
      }}
      onBlur={() => setText(null)}
    />
  );
}
