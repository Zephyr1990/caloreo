import { Icon } from '../components/Icon';
import { MealEditor } from '../components/MealEditor';
import { mealTitle } from '../components/MealRow';
import { todayKey } from '../lib/dates';
import { requestPersistentStorage, saveMeal } from '../lib/db';
import { addDraft, manualMealFromDraft, patchDraft, startDraft } from '../lib/draft';
import { newId } from '../lib/id';
import { formatNumber, sumItems } from '../lib/nutrition';
import { hrefs, navigate } from '../lib/router';
import { MEAL_TYPES, type MealDraft } from '../lib/types';

export function AddMealView() {
  const d = addDraft.value;
  const close = () => {
    const date = d.date;
    startDraft();
    navigate(date === todayKey() ? hrefs.today() : hrefs.day(date), { replace: true });
  };

  if (d.phase === 'review' && d.meal) {
    return <Review meal={d.meal} onClose={close} />;
  }

  return (
    <>
      <main class="screen with-footer">
        <header class="topbar">
          <button type="button" class="round-btn" aria-label="Zamknij" onClick={close}>
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
            class="textarea"
            rows={4}
            value={d.description}
            placeholder="np. Na obiad zjadłem pierś z kurczaka, około 150 g, woreczek ryżu i surówkę z marchewki"
            onInput={(e) => patchDraft({ description: e.currentTarget.value })}
          />
        </div>
      </main>

      <div class="footer">
        <button type="button" class="btn btn-primary" onClick={() => patchDraft({ phase: 'review', meal: manualMealFromDraft(d) })}>
          <Icon name="pencil" size={20} />
          Wpisz ręcznie
        </button>
      </div>
    </>
  );
}

function Review({ meal, onClose }: { meal: MealDraft; onClose: () => void }) {
  const total = sumItems(meal.items).kcal;
  const canSave = meal.items.length > 0 || meal.name.trim() !== '';

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
            onClick={() => patchDraft({ phase: 'compose', meal: null })}
          >
            <Icon name="chevronLeft" />
          </button>
          <h1>Sprawdź i zapisz</h1>
          <span class="spacer-44" />
        </header>
        <MealEditor
          value={meal}
          onChange={(m) => patchDraft({ meal: m })}
          initiallyOpen={meal.source === 'manual' ? (meal.items[0]?.id ?? null) : null}
        />
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
