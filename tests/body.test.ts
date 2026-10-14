import { describe, expect, it } from 'vitest';
import { DEFAULT_BODY, parseBody } from '../src/lib/body';

describe('parseBody', () => {
  it('defaults to a manual goal without profile or plan', () => {
    expect(parseBody(null)).toEqual(DEFAULT_BODY);
  });

  it('keeps a valid profile and plan', () => {
    const raw = {
      profile: { sex: 'male', birthYear: 1990, heightCm: 183, activity: 'high' },
      plan: { startDate: '2026-10-14', startWeight: 80, targetWeight: 72, targetDate: '2026-12-23', acceptedUnsafe: true, createdAt: 'x' },
      goalSource: 'plan',
    };
    expect(parseBody(raw)).toEqual(raw);
  });

  it('drops invalid data and never uses the plan as goal source without a plan', () => {
    expect(parseBody({ profile: { sex: 'x' }, plan: { startDate: 'bad' }, goalSource: 'plan' })).toEqual(DEFAULT_BODY);
  });
});
