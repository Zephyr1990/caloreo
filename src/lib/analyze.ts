import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';
import { newId } from './id';
import type { ModelId } from './settings';
import { mealTypeLabel, type FoodItem, type MealDraft, type MealType } from './types';

export const AnalysisSchema = z.object({
  is_food: z.boolean(),
  meal_name: z.string(),
  items: z.array(
    z.object({
      name: z.string(),
      portion: z.string(),
      grams: z.number(),
      kcal: z.number(),
      protein_g: z.number(),
      fat_g: z.number(),
      carbs_g: z.number(),
    }),
  ),
  confidence: z.enum(['low', 'medium', 'high']),
  notes: z.string(),
});

export type Analysis = z.infer<typeof AnalysisSchema>;

export const SYSTEM_PROMPT = `You estimate the nutrition of meals for a personal calorie-tracking app used in Poland.
The user describes what they ate (often dictated by voice, so expect transcription errors and colloquial Polish) and/or attaches photos of the meal.

How to estimate:
- List each distinct food or drink as its own item. Split a dish into components when that makes the estimate clearer (e.g. bread, butter and ham in a sandwich).
- Prefer quantities the user states (grams, pieces, spoons, glasses, "half a plate") over what you infer from photos. When a quantity is not given, assume a typical Polish home or restaurant portion.
- Include calories that are easy to miss: cooking fat, butter, dressings, sauces, sugar and milk in drinks.
- If the user ate only part of something, count only that part.
- If a photo shows a nutrition label, use its per-100 g values scaled to the portion eaten.
- grams is the weight of the portion as eaten (for drinks, millilitres count as grams).
- Keep each item's numbers consistent: kcal ≈ 4 × protein + 4 × carbs + 9 × fat (+ 7 kcal per gram of alcohol).
- When a previous estimate and a correction are given, apply the correction and return the complete corrected list.

Output:
- Write meal_name, item names, portions and notes in Polish. meal_name is short (at most about 5 words).
- notes lists the main assumptions in 1-3 short sentences, or is empty when there were none.
- confidence is "high" when quantities were stated or clearly visible, "medium" for typical-portion guesses, "low" when the meal itself is unclear.
- If the input does not describe or show food or drink, set is_food to false, return no items, and explain briefly in notes.`;

export interface AnalyzeInput {
  description: string;
  photos: readonly { dataUrl: string }[];
  mealType: MealType;
  /** Items the user already has (after their manual edits), when asking for a correction. */
  previousItems?: readonly FoodItem[] | null;
  correction?: string | null;
}

export interface AnalyzeOptions {
  apiKey: string;
  model: ModelId;
  signal?: AbortSignal;
  /** For tests. */
  fetch?: typeof fetch;
}

export class AnalysisError extends Error {
  readonly aborted: boolean;
  constructor(message: string, opts: { aborted?: boolean } = {}) {
    super(message);
    this.name = 'AnalysisError';
    this.aborted = opts.aborted ?? false;
  }
}

export function dataUrlToBase64(dataUrl: string): string {
  return dataUrl.slice(dataUrl.indexOf(',') + 1);
}

export function buildUserContent(input: AnalyzeInput): Anthropic.Beta.BetaContentBlockParam[] {
  const content: Anthropic.Beta.BetaContentBlockParam[] = input.photos.map((p) => ({
    type: 'image',
    source: { type: 'base64', media_type: 'image/jpeg', data: dataUrlToBase64(p.dataUrl) },
  }));
  const description = input.description.trim();
  const lines = [`Rodzaj posiłku: ${mealTypeLabel(input.mealType).toLowerCase()}.`];
  lines.push(description ? `Opis użytkownika: ${description}` : 'Brak opisu. Oceń posiłek na podstawie zdjęć.');
  const correction = input.correction?.trim();
  if (correction && input.previousItems) {
    const previous = input.previousItems.map((i) => ({
      name: i.name,
      portion: i.portion,
      grams: round1(i.grams),
      kcal: Math.round(i.kcal),
      protein_g: round1(i.protein),
      fat_g: round1(i.fat),
      carbs_g: round1(i.carbs),
    }));
    lines.push(`Poprzednie oszacowanie (z ręcznymi poprawkami użytkownika): ${JSON.stringify(previous)}`);
    lines.push(`Poprawka użytkownika: ${correction}`);
  }
  content.push({ type: 'text', text: lines.join('\n') });
  return content;
}

/** Server-side refusal fallback exists for these models; Haiku 5.5 has none. */
export function supportsServerFallback(model: ModelId): boolean {
  return model === 'claude-opus-5-5' || model === 'claude-sonnet-5-5';
}

export function createClient(apiKey: string, customFetch?: typeof fetch): Anthropic {
  return new Anthropic({
    apiKey,
    // The key belongs to the phone's owner and never leaves their device except to Anthropic.
    dangerouslyAllowBrowser: true,
    maxRetries: 2,
    timeout: 120_000,
    fetch: customFetch,
  });
}

/** Same beta header the SDK's own `.parse()` sends for structured outputs. */
const STRUCTURED_OUTPUTS_BETA = 'structured-outputs-2025-12-15';
const SERVER_FALLBACK_BETA = 'server-side-fallback-2026-07-01';

export async function analyzeMeal(input: AnalyzeInput, opts: AnalyzeOptions): Promise<Analysis> {
  const client = createClient(opts.apiKey, opts.fetch);
  const fallback = supportsServerFallback(opts.model);
  let response;
  try {
    // `.create()` rather than `.parse()`: the stop reason has to be checked before the
    // content is parsed, because a refused request carries no JSON.
    response = await client.beta.messages.create(
      {
        model: opts.model,
        max_tokens: 16000,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: buildUserContent(input) }],
        output_config: { effort: 'medium', format: betaZodOutputFormat(AnalysisSchema) },
        betas: fallback ? [STRUCTURED_OUTPUTS_BETA, SERVER_FALLBACK_BETA] : [STRUCTURED_OUTPUTS_BETA],
        fallbacks: fallback ? 'default' : undefined,
      },
      { signal: opts.signal },
    );
  } catch (e) {
    throw toAnalysisError(e);
  }
  if (response.stop_reason === 'refusal') {
    throw new AnalysisError('Model odmówił analizy. Spróbuj opisać posiłek inaczej.');
  }
  if (response.stop_reason === 'max_tokens') {
    throw new AnalysisError('Odpowiedź modelu została ucięta. Spróbuj podzielić posiłek na mniejsze części.');
  }
  const text = response.content.map((b) => (b.type === 'text' ? b.text : '')).join('');
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new AnalysisError('Nie udało się odczytać odpowiedzi modelu. Spróbuj ponownie.');
  }
  const parsed = AnalysisSchema.safeParse(json);
  if (!parsed.success) {
    throw new AnalysisError('Odpowiedź modelu ma nieoczekiwany format. Spróbuj ponownie.');
  }
  return parsed.data;
}

/** Checks that the key works and can use the model, without spending tokens. */
export async function checkApiKey(apiKey: string, model: ModelId, customFetch?: typeof fetch): Promise<void> {
  try {
    await createClient(apiKey, customFetch).models.retrieve(model);
  } catch (e) {
    throw toAnalysisError(e);
  }
}

export function toAnalysisError(e: unknown): AnalysisError {
  if (e instanceof AnalysisError) return e;
  if (e instanceof Anthropic.APIUserAbortError) return new AnalysisError('Anulowano.', { aborted: true });
  if (e instanceof Anthropic.AuthenticationError) {
    return new AnalysisError('Nieprawidłowy klucz API. Sprawdź go w Ustawieniach.');
  }
  if (e instanceof Anthropic.PermissionDeniedError) {
    return new AnalysisError('Ten klucz API nie ma dostępu do wybranego modelu.');
  }
  if (e instanceof Anthropic.NotFoundError) {
    return new AnalysisError('Wybrany model jest niedostępny. Zmień model w Ustawieniach.');
  }
  if (e instanceof Anthropic.RateLimitError) {
    return new AnalysisError('Przekroczono limit zapytań do API. Spróbuj za chwilę.');
  }
  if (e instanceof Anthropic.BadRequestError) {
    return new AnalysisError(`API odrzuciło zapytanie: ${e.message}`);
  }
  if (e instanceof Anthropic.InternalServerError) {
    return new AnalysisError('Serwery Anthropic są chwilowo przeciążone. Spróbuj ponownie za chwilę.');
  }
  if (e instanceof Anthropic.APIConnectionTimeoutError) {
    return new AnalysisError('Przekroczono czas oczekiwania na odpowiedź. Spróbuj ponownie.');
  }
  if (e instanceof Anthropic.APIConnectionError) {
    return new AnalysisError('Brak połączenia z internetem albo z serwerem Anthropic.');
  }
  if (e instanceof Anthropic.APIError) {
    return new AnalysisError(`Błąd API${e.status ? ` (${e.status})` : ''}: ${e.message}`);
  }
  return new AnalysisError(`Nieoczekiwany błąd: ${e instanceof Error ? e.message : String(e)}`);
}

export interface DraftContext {
  type: MealType;
  date: string;
  time: string;
  description: string;
  thumbnail: string | null;
}

export function analysisToDraft(a: Analysis, ctx: DraftContext, model: ModelId): MealDraft {
  return {
    ...ctx,
    name: a.meal_name.trim(),
    items: a.items.map((i) => ({
      id: newId(),
      name: i.name.trim(),
      portion: i.portion.trim(),
      grams: nonNegative(i.grams),
      kcal: nonNegative(i.kcal),
      protein: nonNegative(i.protein_g),
      fat: nonNegative(i.fat_g),
      carbs: nonNegative(i.carbs_g),
    })),
    notes: a.notes.trim(),
    confidence: a.confidence,
    source: 'ai',
    model,
  };
}

function nonNegative(n: number): number {
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
