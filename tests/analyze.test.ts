import { describe, expect, it } from 'vitest';
import {
  analysisToDraft,
  analyzeMeal,
  AnalysisError,
  buildUserContent,
  checkApiKey,
  supportsServerFallback,
  type Analysis,
} from '../src/lib/analyze';
import { fitSize } from '../src/lib/image';

const ANALYSIS: Analysis = {
  is_food: true,
  meal_name: 'Kurczak z ryżem',
  items: [
    { name: 'Pierś z kurczaka z grilla', portion: '150 g', grams: 150, kcal: 248, protein_g: 46, fat_g: 5, carbs_g: 0 },
    { name: 'Ryż biały ugotowany', portion: '1 woreczek', grams: 260, kcal: 345, protein_g: 7, fat_g: 1, carbs_g: 78 },
  ],
  confidence: 'medium',
  notes: 'Ryż bez tłuszczu.',
};

interface Captured {
  url: string;
  headers: Headers;
  body: Record<string, unknown> | null;
}

function fakeFetch(status: number, payload: unknown, captured: Captured[] = []): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    captured.push({
      url: String(input),
      headers: new Headers(init?.headers),
      body: typeof init?.body === 'string' ? JSON.parse(init.body) : null,
    });
    return new Response(JSON.stringify(payload), { status, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;
}

function message(text: string, stop_reason = 'end_turn') {
  return {
    id: 'msg_test',
    type: 'message',
    role: 'assistant',
    model: 'claude-haiku-5-5',
    content: [{ type: 'text', text }],
    stop_reason,
    stop_sequence: null,
    usage: { input_tokens: 100, output_tokens: 50 },
  };
}

const PHOTO = { dataUrl: 'data:image/jpeg;base64,AAAA' };

describe('buildUserContent', () => {
  it('puts photos first and the description last', () => {
    const content = buildUserContent({ description: 'jajecznica z 3 jaj', photos: [PHOTO], mealType: 'breakfast' });
    expect(content[0]).toEqual({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: 'AAAA' } });
    expect(content[1]).toMatchObject({ type: 'text' });
    const text = (content[1] as { text: string }).text;
    expect(text).toContain('Rodzaj posiłku: śniadanie.');
    expect(text).toContain('Opis użytkownika: jajecznica z 3 jaj');
  });

  it('lists the names the user already uses, only when there are some', () => {
    const withNames = buildUserContent({ description: 'serek', photos: [], mealType: 'breakfast', knownNames: ['Serek wiejski', 'Cappuccino'] });
    expect((withNames[0] as { text: string }).text).toContain('Nazwy produktów, których użytkownik już używa: ["Serek wiejski","Cappuccino"]');
    const without = buildUserContent({ description: 'serek', photos: [], mealType: 'breakfast', knownNames: [] });
    expect((without[0] as { text: string }).text).not.toContain('Nazwy produktów');
  });

  it('asks to judge from photos when there is no description', () => {
    const content = buildUserContent({ description: '  ', photos: [PHOTO], mealType: 'lunch' });
    expect((content[1] as { text: string }).text).toContain('Brak opisu');
  });

  it('includes the previous items and the correction', () => {
    const content = buildUserContent({
      description: 'kurczak z ryżem',
      photos: [],
      mealType: 'lunch',
      previousItems: [{ id: 'x', name: 'Ryż', portion: '', grams: 260, kcal: 345.4, protein: 7, fat: 1, carbs: 78 }],
      correction: 'ryżu było pół woreczka',
    });
    const text = (content[0] as { text: string }).text;
    expect(text).toContain('"name":"Ryż"');
    expect(text).toContain('"kcal":345');
    expect(text).toContain('Poprawka użytkownika: ryżu było pół woreczka');
  });
});

describe('analyzeMeal', () => {
  it('sends a structured-output request and returns the parsed analysis', async () => {
    const captured: Captured[] = [];
    const result = await analyzeMeal(
      { description: 'kurczak z ryżem', photos: [PHOTO], mealType: 'lunch' },
      { apiKey: 'sk-test', model: 'claude-haiku-5-5', fetch: fakeFetch(200, message(JSON.stringify(ANALYSIS)), captured) },
    );
    expect(result).toEqual(ANALYSIS);
    expect(captured).toHaveLength(1);
    const req = captured[0];
    expect(req.url).toContain('/v1/messages');
    expect(req.headers.get('x-api-key')).toBe('sk-test');
    expect(req.headers.get('anthropic-dangerous-direct-browser-access')).toBe('true');
    expect(req.headers.get('anthropic-beta')).toBe('structured-outputs-2025-12-15');
    expect(req.body?.model).toBe('claude-haiku-5-5');
    expect(req.body?.fallbacks).toBeUndefined();
    expect(req.body?.output_config).toMatchObject({ effort: 'medium', format: { type: 'json_schema' } });
  });

  it('opts into server-side fallbacks for Opus and Sonnet', async () => {
    const captured: Captured[] = [];
    await analyzeMeal(
      { description: 'kanapka', photos: [], mealType: 'breakfast' },
      { apiKey: 'sk-test', model: 'claude-opus-5-5', fetch: fakeFetch(200, message(JSON.stringify(ANALYSIS)), captured) },
    );
    expect(captured[0].headers.get('anthropic-beta')).toContain('server-side-fallback-2026-07-01');
    expect(captured[0].body?.fallbacks).toBe('default');
    expect(supportsServerFallback('claude-sonnet-5-5')).toBe(true);
    expect(supportsServerFallback('claude-haiku-5-5')).toBe(false);
  });

  it('reports a refusal in Polish', async () => {
    await expect(
      analyzeMeal(
        { description: 'x', photos: [], mealType: 'snack' },
        { apiKey: 'sk-test', model: 'claude-haiku-5-5', fetch: fakeFetch(200, message('', 'refusal')) },
      ),
    ).rejects.toThrow('Model odmówił analizy');
  });

  it('rejects JSON that does not match the schema', async () => {
    await expect(
      analyzeMeal(
        { description: 'x', photos: [], mealType: 'snack' },
        { apiKey: 'sk-test', model: 'claude-haiku-5-5', fetch: fakeFetch(200, message('{"items": "nope"}')) },
      ),
    ).rejects.toThrow('nieoczekiwany format');
  });

  it('maps an invalid key to a Polish message', async () => {
    const error = { type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } };
    const promise = analyzeMeal(
      { description: 'x', photos: [], mealType: 'snack' },
      { apiKey: 'bad', model: 'claude-haiku-5-5', fetch: fakeFetch(401, error) },
    );
    await expect(promise).rejects.toBeInstanceOf(AnalysisError);
    await expect(promise).rejects.toThrow('Nieprawidłowy klucz API');
  });

  it('checks the key with the models endpoint', async () => {
    const captured: Captured[] = [];
    await checkApiKey(
      'sk-test',
      'claude-haiku-5-5',
      fakeFetch(200, { id: 'claude-haiku-5-5', type: 'model', display_name: 'Claude Haiku 5.5', created_at: '2026-01-01T00:00:00Z' }, captured),
    );
    expect(captured[0].url).toContain('/v1/models/claude-haiku-5-5');
  });
});

describe('analysisToDraft', () => {
  it('maps the analysis to editable items', () => {
    const draft = analysisToDraft(
      { ...ANALYSIS, items: [{ ...ANALYSIS.items[0], kcal: -5, fat_g: Number.NaN }] },
      { type: 'lunch', date: '2026-10-14', time: '13:40', description: 'kurczak', thumbnail: null },
      'claude-haiku-5-5',
    );
    expect(draft.name).toBe('Kurczak z ryżem');
    expect(draft.source).toBe('ai');
    expect(draft.confidence).toBe('medium');
    expect(draft.items[0]).toMatchObject({ name: 'Pierś z kurczaka z grilla', grams: 150, kcal: 0, protein: 46, fat: 0 });
    expect(draft.items[0].id).toBeTruthy();
  });
});

describe('fitSize', () => {
  it('shrinks the longest side and keeps small images as they are', () => {
    expect(fitSize(4032, 3024, 1568)).toEqual({ width: 1568, height: 1176 });
    expect(fitSize(3024, 4032, 1568)).toEqual({ width: 1176, height: 1568 });
    expect(fitSize(800, 600, 1568)).toEqual({ width: 800, height: 600 });
  });
});
