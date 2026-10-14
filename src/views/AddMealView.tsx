import { useRef, useState } from 'preact/hooks';
import { Icon } from '../components/Icon';
import { MealEditor } from '../components/MealEditor';
import { mealTitle } from '../components/MealRow';
import { todayKey } from '../lib/dates';
import { requestPersistentStorage, saveMeal } from '../lib/db';
import { addDraft, manualMealFromDraft, patchDraft, startDraft, type AddDraft } from '../lib/draft';
import { addPhotos, cancelAnalysis, MAX_PHOTOS, removePhoto, runAnalysis } from '../lib/flow';
import { newId } from '../lib/id';
import { formatNumber, sumItems } from '../lib/nutrition';
import { hrefs, navigate } from '../lib/router';
import { MODELS, settings } from '../lib/settings';
import { MEAL_TYPES, type MealDraft } from '../lib/types';

export function AddMealView() {
  const d = addDraft.value;
  const close = () => {
    const date = d.date;
    cancelAnalysis();
    startDraft();
    navigate(date === todayKey() ? hrefs.today() : hrefs.day(date), { replace: true });
  };

  if (d.phase === 'analyzing') return <Analyzing />;
  if (d.phase === 'review' && d.meal) return <Review meal={d.meal} error={d.error} onClose={close} />;
  return <Compose d={d} onClose={close} />;
}

function Compose({ d, onClose }: { d: AddDraft; onClose: () => void }) {
  const hasKey = settings.value.apiKey !== '';
  const canAnalyze = hasKey && (d.description.trim() !== '' || d.photos.length > 0);

  return (
    <>
      <main class="screen" style={{ paddingBottom: 'calc(160px + var(--safe-bottom))' }}>
        <header class="topbar">
          <button type="button" class="round-btn" aria-label="Zamknij" onClick={onClose}>
            <Icon name="close" size={20} />
          </button>
          <h1>Nowy posiłek</h1>
          <span class="spacer-44" />
        </header>

        <fieldset class="field" style={{ border: 'none', margin: 0, padding: 0 }}>
          <legend class="label" style={{ padding: 0, marginBottom: '8px' }}>
            Rodzaj posiłku
          </legend>
          <div class="chips">
            {MEAL_TYPES.map((t) => (
              <button
                key={t.id}
                type="button"
                class="chip"
                aria-pressed={d.type === t.id}
                onClick={() => patchDraft({ type: t.id })}
              >
                {t.label}
              </button>
            ))}
          </div>
        </fieldset>

        <PhotoStrip photos={d.photos} />

        <div class="field">
          <label class="label" for="description">
            Opis (mów lub pisz)
          </label>
          <textarea
            id="description"
            class="textarea"
            rows={4}
            value={d.description}
            placeholder="np. Na obiad zjadłem pierś z kurczaka, około 150 g, woreczek ryżu i surówkę z marchewki"
            onInput={(e) => patchDraft({ description: e.currentTarget.value })}
          />
          <div class="small muted">Podaj gramy lub miary, jeśli je znasz: „150 gramów”, „szklanka”, „pół talerza”.</div>
        </div>

        {d.error && (
          <div class="error" role="alert">
            <strong>Nie udało się.</strong> {d.error}
          </div>
        )}

        {!hasKey && (
          <div class="notice">
            <div class="notice-title">
              <Icon name="key" size={16} />
              Brak klucza API
            </div>
            <p style={{ margin: 0 }}>
              Analiza AI wymaga klucza API Anthropic. <a href={hrefs.settings()}>Dodaj go w Ustawieniach</a>. Bez klucza
              możesz wpisać posiłek ręcznie.
            </p>
          </div>
        )}
      </main>

      <div class="footer">
        <button type="button" class="btn btn-primary" disabled={!canAnalyze} onClick={() => runAnalysis()}>
          <Icon name="analyze" size={20} />
          Policz kalorie
        </button>
        <button
          type="button"
          class="btn btn-ghost"
          onClick={() => patchDraft({ phase: 'review', meal: manualMealFromDraft(d), error: null })}
        >
          Wpisz ręcznie, bez AI
        </button>
      </div>
    </>
  );
}

function PhotoStrip({ photos }: { photos: AddDraft['photos'] }) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const full = photos.length >= MAX_PHOTOS;
  const onPick = (e: Event) => {
    const input = e.currentTarget as HTMLInputElement;
    void addPhotos(input.files).finally(() => {
      input.value = '';
    });
  };

  return (
    <section class="stack" aria-label="Zdjęcia">
      <div class="label">Zdjęcia (opcjonalnie, do {MAX_PHOTOS})</div>
      <div class="photo-strip">
        {photos.map((p, i) => (
          <div key={p.id} class="photo">
            <img src={p.thumb} alt={`Zdjęcie ${i + 1}`} />
            <button type="button" class="photo-remove" aria-label={`Usuń zdjęcie ${i + 1}`} onClick={() => removePhoto(p.id)}>
              <Icon name="close" size={14} strokeWidth={2.5} />
            </button>
          </div>
        ))}
        {!full && (
          <>
            <button type="button" class="photo-add" onClick={() => cameraRef.current?.click()}>
              <Icon name="camera" />
              Aparat
            </button>
            <button type="button" class="photo-add" onClick={() => galleryRef.current?.click()}>
              <Icon name="image" />
              Galeria
            </button>
          </>
        )}
      </div>
      <input ref={cameraRef} class="visually-hidden" type="file" accept="image/*" capture="environment" tabIndex={-1} aria-hidden="true" onChange={onPick} />
      <input ref={galleryRef} class="visually-hidden" type="file" accept="image/*" multiple tabIndex={-1} aria-hidden="true" onChange={onPick} />
    </section>
  );
}

function Analyzing() {
  const model = MODELS.find((m) => m.id === settings.value.model)?.label ?? settings.value.model;
  return (
    <main class="screen" style={{ minHeight: '100dvh', justifyContent: 'center' }}>
      <section class="card" style={{ alignItems: 'center', textAlign: 'center', padding: '32px 20px', gap: '16px' }} aria-live="polite">
        <div class="spinner" aria-hidden="true" />
        <div style={{ fontSize: '18px', fontWeight: 700 }}>Liczę kalorie…</div>
        <div class="muted" style={{ fontSize: '14px' }}>
          {model} analizuje opis i zdjęcia. To zwykle trwa kilka sekund.
        </div>
        <button type="button" class="btn btn-ghost" onClick={cancelAnalysis}>
          Anuluj
        </button>
      </section>
    </main>
  );
}

function Review({ meal, error, onClose }: { meal: MealDraft; error: string | null; onClose: () => void }) {
  const [correction, setCorrection] = useState('');
  const total = sumItems(meal.items).kcal;
  const canSave = meal.items.length > 0 || meal.name.trim() !== '';
  const hasKey = settings.value.apiKey !== '';

  const save = async () => {
    const now = new Date().toISOString();
    const items = meal.items.filter((i) => i.name.trim() || i.kcal > 0);
    await saveMeal({
      ...meal,
      name: mealTitle({ ...meal, items }),
      items,
      id: newId(),
      createdAt: now,
      updatedAt: now,
    });
    void requestPersistentStorage();
    onClose();
  };

  return (
    <>
      <main class="screen with-footer">
        <header class="topbar">
          <button
            type="button"
            class="round-btn"
            aria-label="Wróć do opisu"
            onClick={() => patchDraft({ phase: 'compose', meal: null, error: null })}
          >
            <Icon name="chevronLeft" />
          </button>
          <h1>Sprawdź i zapisz</h1>
          <span class="spacer-44" />
        </header>

        {error && (
          <div class="error" role="alert">
            <strong>Nie udało się.</strong> {error}
          </div>
        )}

        <MealEditor
          value={meal}
          onChange={(m) => patchDraft({ meal: m })}
          initiallyOpen={meal.source === 'manual' ? (meal.items[0]?.id ?? null) : null}
        />

        {hasKey && meal.source === 'ai' && (
          <section class="card" aria-label="Poprawka">
            <label for="correction" style={{ fontSize: '16px', fontWeight: 700 }}>
              Coś się nie zgadza?
            </label>
            <textarea
              id="correction"
              class="textarea"
              rows={2}
              value={correction}
              placeholder="np. ryżu było pół woreczka, kurczak był smażony"
              onInput={(e) => setCorrection(e.currentTarget.value)}
            />
            <button
              type="button"
              class="btn btn-outline"
              disabled={!correction.trim()}
              onClick={() => runAnalysis(correction)}
            >
              <Icon name="analyze" size={20} />
              Popraw i przelicz
            </button>
          </section>
        )}
      </main>
      <div class="footer">
        <button type="button" class="btn btn-primary" disabled={!canSave} onClick={save}>
          <Icon name="check" size={20} strokeWidth={2.5} />
          Zapisz posiłek · {formatNumber(total)} kcal
        </button>
      </div>
    </>
  );
}
