import { useEffect, useState } from 'preact/hooks';
import { Icon } from '../components/Icon';
import { MealEditor } from '../components/MealEditor';
import { mealTitle } from '../components/MealRow';
import { timeOf, todayKey } from '../lib/dates';
import { deleteMeal, getMeal, saveMeal } from '../lib/db';
import { newId } from '../lib/id';
import { mealTypeForTime } from '../lib/nutrition';
import { hrefs, navigate } from '../lib/router';
import type { Meal, MealDraft } from '../lib/types';

function toDraft(m: Meal): MealDraft {
  const { id: _id, createdAt: _c, updatedAt: _u, ...draft } = m;
  return draft;
}

function dayHref(date: string): string {
  return date === todayKey() ? hrefs.today() : hrefs.day(date);
}

export function MealView({ id }: { id: string }) {
  const [meal, setMeal] = useState<Meal | null | undefined>(undefined);
  const [edit, setEdit] = useState<MealDraft | null>(null);

  useEffect(() => {
    let alive = true;
    getMeal(id).then((m) => {
      if (!alive) return;
      setMeal(m ?? null);
      setEdit(m ? toDraft(m) : null);
    });
    return () => {
      alive = false;
    };
  }, [id]);

  if (meal === undefined) return <main class="screen" aria-busy="true" />;

  if (meal === null || edit === null) {
    return (
      <main class="screen">
        <header class="topbar">
          <a class="round-btn" href={hrefs.today()} aria-label="Wróć">
            <Icon name="chevronLeft" />
          </a>
          <h1>Posiłek</h1>
          <span class="spacer-44" />
        </header>
        <div class="empty">Nie znaleziono tego posiłku. Mógł zostać usunięty.</div>
      </main>
    );
  }

  const dirty = JSON.stringify(edit) !== JSON.stringify(toDraft(meal));

  const save = async () => {
    const items = edit.items.filter((i) => i.name.trim() || i.kcal > 0);
    await saveMeal({ ...meal, ...edit, items, name: mealTitle({ ...edit, items }), updatedAt: new Date().toISOString() });
    navigate(dayHref(edit.date), { replace: true });
  };

  const eatAgain = async () => {
    const now = new Date();
    const stamp = now.toISOString();
    const source = toDraft(meal);
    await saveMeal({
      ...source,
      items: source.items.map((i) => ({ ...i, id: newId() })),
      id: newId(),
      date: todayKey(now),
      time: timeOf(now),
      type: mealTypeForTime(now.getHours(), now.getMinutes()),
      createdAt: stamp,
      updatedAt: stamp,
    });
    navigate(hrefs.today(), { replace: true });
  };

  const remove = async () => {
    if (!window.confirm('Usunąć ten posiłek?')) return;
    await deleteMeal(meal.id);
    navigate(dayHref(meal.date), { replace: true });
  };

  return (
    <>
      <main class="screen" style={{ paddingBottom: 'calc(210px + var(--safe-bottom))' }}>
        <header class="topbar">
          <a class="round-btn" href={dayHref(meal.date)} aria-label="Wróć do dnia">
            <Icon name="chevronLeft" />
          </a>
          <h1>Posiłek</h1>
          <span class="spacer-44" />
        </header>
        {meal.description.trim() && (
          <section class="notice" aria-label="Twój opis">
            <div class="notice-title">Twój opis</div>
            <p style={{ margin: 0 }}>{meal.description}</p>
          </section>
        )}
        <MealEditor value={edit} onChange={setEdit} />
      </main>
      <div class="footer">
        <button type="button" class="btn btn-primary" disabled={!dirty} onClick={save}>
          <Icon name="check" size={20} strokeWidth={2.5} />
          Zapisz zmiany
        </button>
        <div class="grid-2">
          <button type="button" class="btn btn-ghost" onClick={eatAgain}>
            <Icon name="repeat" size={20} />
            Zjedz ponownie
          </button>
          <button type="button" class="btn btn-danger" onClick={remove}>
            <Icon name="trash" size={20} />
            Usuń
          </button>
        </div>
      </div>
    </>
  );
}
