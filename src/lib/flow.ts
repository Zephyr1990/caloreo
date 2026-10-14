import { addDraft, patchDraft, type DraftPhoto } from './draft';
import { newId } from './id';
import { settings } from './settings';

export const MAX_PHOTOS = 4;

/** Resizes picked photos and adds them to the draft (up to MAX_PHOTOS). */
export async function addPhotos(files: FileList | File[] | null): Promise<void> {
  const list = Array.from(files ?? []).slice(0, Math.max(0, MAX_PHOTOS - addDraft.value.photos.length));
  if (list.length === 0) return;
  const { prepareImage } = await import('./image');
  const added: DraftPhoto[] = [];
  let failed = 0;
  for (const file of list) {
    try {
      added.push({ id: newId(), ...(await prepareImage(file)) });
    } catch {
      failed++;
    }
  }
  patchDraft({
    photos: [...addDraft.value.photos, ...added].slice(0, MAX_PHOTOS),
    error: failed ? 'Nie udało się wczytać części zdjęć. Spróbuj zrobić zdjęcie jeszcze raz.' : addDraft.value.error,
  });
}

export function removePhoto(id: string): void {
  patchDraft({ photos: addDraft.value.photos.filter((p) => p.id !== id) });
}

let controller: AbortController | null = null;

/**
 * Sends the draft to the AI. With `correction`, asks for a corrected version of the
 * items currently under review (including the user's manual edits).
 */
export async function runAnalysis(correction?: string): Promise<void> {
  const d = addDraft.value;
  const s = settings.value;
  const back = d.phase === 'review' ? 'review' : 'compose';
  if (!s.apiKey) {
    patchDraft({ error: 'Brak klucza API. Dodaj go w Ustawieniach, aby korzystać z analizy AI.' });
    return;
  }
  const previous = correction && d.meal ? d.meal : null;

  controller?.abort();
  const ctrl = new AbortController();
  controller = ctrl;
  patchDraft({ phase: 'analyzing', error: null });

  try {
    const { analyzeMeal, analysisToDraft } = await import('./analyze');
    const analysis = await analyzeMeal(
      {
        description: d.description,
        photos: d.photos,
        mealType: previous?.type ?? d.type,
        previousItems: previous?.items ?? null,
        correction: correction ?? null,
      },
      { apiKey: s.apiKey, model: s.model, signal: ctrl.signal },
    );
    if (controller !== ctrl) return;
    if (!analysis.is_food || analysis.items.length === 0) {
      patchDraft({
        phase: back,
        error: `Nie rozpoznano jedzenia w opisie ani na zdjęciach.${analysis.notes ? ` ${analysis.notes}` : ''}`,
      });
      return;
    }
    const description = correction
      ? `${d.description.trim()}\nPoprawka: ${correction.trim()}`.trim()
      : d.description.trim();
    const meal = analysisToDraft(
      analysis,
      {
        type: previous?.type ?? d.type,
        date: previous?.date ?? d.date,
        time: previous?.time ?? d.time,
        description,
        thumbnail: d.photos[0]?.thumb ?? null,
      },
      s.model,
    );
    patchDraft({ phase: 'review', meal, description, error: null });
  } catch (e) {
    if (controller !== ctrl) return;
    const { toAnalysisError } = await import('./analyze');
    const err = toAnalysisError(e);
    patchDraft({ phase: back, error: err.aborted ? null : err.message });
  } finally {
    if (controller === ctrl) controller = null;
  }
}

export function cancelAnalysis(): void {
  controller?.abort();
}
