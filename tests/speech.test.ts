import { describe, expect, it } from 'vitest';
import { collectTranscript, joinText, speechErrorMessage, speechSupported } from '../src/lib/speech';

describe('joinText', () => {
  it('appends dictated words with a single space', () => {
    expect(joinText('Na obiad', 'kurczak')).toBe('Na obiad kurczak');
    expect(joinText('Na obiad ', '  kurczak ')).toBe('Na obiad kurczak');
    expect(joinText('', 'kurczak')).toBe('kurczak');
    expect(joinText('Na obiad', '  ')).toBe('Na obiad');
  });
});

describe('collectTranscript', () => {
  it('joins final segments and keeps interim words apart', () => {
    expect(
      collectTranscript([
        { isFinal: true, transcript: 'Na obiad zjadłem kurczaka' },
        { isFinal: true, transcript: ' i ryż' },
        { isFinal: false, transcript: 'z surówką' },
      ]),
    ).toEqual({ final: 'Na obiad zjadłem kurczaka i ryż', interim: 'z surówką' });
  });

  it('does not duplicate text when an engine repeats everything said so far', () => {
    expect(
      collectTranscript([
        { isFinal: true, transcript: 'Na obiad' },
        { isFinal: true, transcript: 'Na obiad zjadłem kurczaka' },
      ]),
    ).toEqual({ final: 'Na obiad zjadłem kurczaka', interim: '' });
  });
});

describe('speech errors', () => {
  it('ignores aborts and explains the rest in Polish', () => {
    expect(speechErrorMessage('aborted')).toBeNull();
    expect(speechErrorMessage('not-allowed')).toContain('Brak zgody');
    expect(speechErrorMessage('weird')).toContain('weird');
  });

  it('reports no support outside a browser', () => {
    expect(speechSupported()).toBe(false);
  });
});
