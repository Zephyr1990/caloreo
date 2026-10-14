import { useRef, useState } from 'preact/hooks';
import { Icon } from '../components/Icon';
import { MealEditor } from '../components/MealEditor';
import { mealTitle } from '../components/MealRow';
import { MicPanel } from '../components/MicPanel';
import { todayKey } from '../lib/dates';
import { requestPersistentStorage, saveMeal } from '../lib/db';
import { addDraft, manualMealFromDraft, patchDraft, startDraft, type AddDraft } from '../lib/draft';
import { addPhotos, cancelAnalysis, MAX_PHOTOS, removePhoto, runAnalysis } from '../lib/flow';
import { newId } from '../lib/id';
import { formatNumber, sumItems } from '../lib/nutrition';
import { hrefs, navigate } from '../lib/router';
import { MODELS, settings } from '../lib/settings';
import { cancelListening, speech, stopListening } from '../lib/speech';
import { MEAL_TYPES, type MealDraft } from '../lib/types';

export function AddMealView() {
  const d = addDraft.value;
  const close = () => {
    const date = d.date;
    cancelListening();
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
  const listening = speech.value.listening && speech.value.target === 'description';
  const canAnalyze = hasKey && (d.description.trim() !== '' || d.photos.length > 0 || listening);
  const analyze = async () => {
    await stopListening();
    void runAnalysis();
  };
  const manual = async () => {
    await stopListening();
    const current = addDraft.value;
    patchDraft({ phase: 'review', meal: manualMealFromDraft(current), error: null });
  };

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

        <div class="field">
          <label class="label" for="description">
            Opis (mów lub pisz)
          </label>
          <textarea
            id="description"
            class={listening ? 'textarea active' : 'textarea'}
            rows={3}
            value={d.description}
            placeholder="np. Na obiad zjadłem pierś z kurczaka, około 150 g, woreczek ryżu i surówkę z marchewki"
            onInput={(e) => patchDraft({ description: e.currentTarget.value })}
          />
        </div>

        <MicPanel
          target="description"
          value={d.description}
          onText={(description) => patchDraft({ description })}
          idleTitle="Dotknij i powiedz, co zjadłeś"
          idleHint="Podaj gramy lub miary, jeśli je znasz: „150 gramów”, „szklanka”, „pół talerza”."
        />

        {d.error && (
          <div class="error" role="alert">
            <strong>Nie udało się.</strong> {d.error}
          </div>
        )}

        <PhotoStrip photos={d.photos} />

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
        <button type="button" class="btn btn-primary" disabled={!canAnalyze} onClick={analyze}>
          <Icon name="analyze" size={20} />
          Policz kalorie
        </button>
        <button type="button" class="btn btn-ghost" onClick={manual}>
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
  const [correction, setCorrectionState] = useState('');
  // Dictation updates arrive between renders; the ref always holds the latest text.
  const correctionRef = useRef('');
  const setCorrection = (text: string) => {
    correctionRef.current = text;
    setCorrectionState(text);
  };
  const recalculate = async () => {
    await stopListening();
    const text = correctionRef.current.trim();
    if (text) void runAnalysis(text);
  };
  const correcting = speech.value.listening && speech.value.target === 'correction';
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
    cancelListening();
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
            onClick={() => {
              cancelListening();
              patchDraft({ phase: 'compose', meal: null, error: null });
            }}
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
              class={correcting ? 'textarea active' : 'textarea'}
              rows={2}
              value={correction}
              placeholder="np. ryżu było pół woreczka, kurczak był smażony"
              onInput={(e) => setCorrection(e.currentTarget.value)}
            />
            <MicPanel
              target="correction"
              value={correction}
              onText={setCorrection}
              idleTitle="Popraw głosem"
              idleHint="Powiedz, co się nie zgadza, a AI przeliczy posiłek."
            />
            <button
              type="button"
              class="btn btn-outline"
              disabled={!correction.trim() && !correcting}
              onClick={recalculate}
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
