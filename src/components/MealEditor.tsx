import { useRef, useState } from 'preact/hooks';
import { emptyItem } from '../lib/draft';
import { isDateKey, isTime } from '../lib/dates';
import { formatGrams, formatNumber, scaleItem, sumItems } from '../lib/nutrition';
import { CONFIDENCE_LABELS, MEAL_TYPES, type FoodItem, type MealDraft } from '../lib/types';
import { Icon } from './Icon';
import { NumberField } from './NumberField';

interface Props {
  value: MealDraft;
  onChange: (next: MealDraft) => void;
  /** Item id opened when the editor first renders. */
  initiallyOpen?: string | null;
}

export function MealEditor({ value, onChange, initiallyOpen = null }: Props) {
  const [openId, setOpenId] = useState<string | null>(initiallyOpen);
  const totals = sumItems(value.items);
  const set = (patch: Partial<MealDraft>) => onChange({ ...value, ...patch });

  const updateItem = (item: FoodItem) => set({ items: value.items.map((i) => (i.id === item.id ? item : i)) });
  const removeItem = (id: string) => set({ items: value.items.filter((i) => i.id !== id) });
  const addItem = () => {
    const item = emptyItem();
    set({ items: [...value.items, item] });
    setOpenId(item.id);
  };

  return (
    <>
      <div class="field">
        <label class="label" for="meal-name">
          Nazwa posiłku
        </label>
        <input
          id="meal-name"
          class="input"
          type="text"
          value={value.name}
          placeholder="np. Kurczak z ryżem"
          onInput={(e) => set({ name: e.currentTarget.value })}
        />
      </div>

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
              aria-pressed={value.type === t.id}
              onClick={() => set({ type: t.id })}
            >
              {t.label}
            </button>
          ))}
        </div>
      </fieldset>

      <div class="grid-2">
        <div class="field">
          <label class="label" for="meal-date">
            Dzień
          </label>
          <input
            id="meal-date"
            class="input compact"
            type="date"
            value={value.date}
            onInput={(e) => isDateKey(e.currentTarget.value) && set({ date: e.currentTarget.value })}
          />
        </div>
        <div class="field">
          <label class="label" for="meal-time">
            Godzina
          </label>
          <input
            id="meal-time"
            class="input compact"
            type="time"
            value={value.time}
            onInput={(e) => isTime(e.currentTarget.value) && set({ time: e.currentTarget.value })}
          />
        </div>
      </div>

      <section class="card" aria-label="Suma">
        <div class="row-between" style={{ alignItems: 'flex-start' }}>
          <div class="stack" style={{ gap: '2px' }}>
            <div class="label">Razem</div>
            <div class="hero">
              <span class="hero-value" style={{ fontSize: '48px' }}>
                {formatNumber(totals.kcal)}
              </span>
              <span class="hero-unit">kcal</span>
            </div>
          </div>
          {value.confidence && (
            <span class="pill">
              <Icon name="info" size={16} />
              Pewność: {CONFIDENCE_LABELS[value.confidence]}
            </span>
          )}
        </div>
        <div class="row" style={{ gap: '16px', fontSize: '14px', color: 'var(--ink-2)', flexWrap: 'wrap' }}>
          <span class="row" style={{ gap: '6px' }}>
            <span class="swatch bg-protein" />
            Białko {formatGrams(totals.protein)} g
          </span>
          <span class="row" style={{ gap: '6px' }}>
            <span class="swatch bg-fat" />
            Tłuszcz {formatGrams(totals.fat)} g
          </span>
          <span class="row" style={{ gap: '6px' }}>
            <span class="swatch bg-carbs" />
            Węgl. {formatGrams(totals.carbs)} g
          </span>
        </div>
      </section>

      <section class="stack" aria-label="Składniki">
        <h2 style={{ margin: '0 0 0 4px', fontSize: '17px', fontWeight: 800 }}>Składniki ({value.items.length})</h2>
        {value.items.map((item) => (
          <ItemEditor
            key={item.id}
            item={item}
            open={openId === item.id}
            onToggle={() => setOpenId(openId === item.id ? null : item.id)}
            onChange={updateItem}
            onDelete={() => removeItem(item.id)}
          />
        ))}
        <button type="button" class="btn btn-dashed" onClick={addItem}>
          <Icon name="plus" size={18} />
          Dodaj składnik
        </button>
      </section>

      {value.notes.trim() && (
        <section class="notice" aria-label="Założenia AI">
          <div class="notice-title">
            <Icon name="info" size={16} />
            Założenia AI
          </div>
          <p style={{ margin: 0 }}>{value.notes}</p>
        </section>
      )}
    </>
  );
}

interface ItemProps {
  item: FoodItem;
  open: boolean;
  onToggle: () => void;
  onChange: (item: FoodItem) => void;
  onDelete: () => void;
}

function ItemEditor({ item, open, onToggle, onChange, onDelete }: ItemProps) {
  // Grams edits scale from the values the item had when editing started.
  const base = useRef<FoodItem>(item);
  const fid = (name: string) => `item-${item.id}-${name}`;
  const macroLine = `B ${formatGrams(item.protein)} · T ${formatGrams(item.fat)} · W ${formatGrams(item.carbs)}`;
  const sub = [item.portion.trim() || (item.grams > 0 ? `${formatGrams(item.grams)} g` : ''), macroLine]
    .filter(Boolean)
    .join(' · ');

  return (
    <div class={open ? 'item open' : 'item'}>
      <button type="button" class="item-summary" aria-expanded={open} onClick={onToggle}>
        <span class="meal-main">
          <span style={{ fontSize: '15px', fontWeight: 600 }}>{item.name.trim() || 'Nowy składnik'}</span>
          <span class="meal-meta">{sub}</span>
        </span>
        <span style={{ fontSize: '16px', fontWeight: 700, whiteSpace: 'nowrap' }}>{formatNumber(item.kcal)} kcal</span>
      </button>
      {open && (
        <div class="item-body">
          <div class="field">
            <label class="mini-label" for={fid('name')}>
              Nazwa
            </label>
            <input
              id={fid('name')}
              class="input compact"
              type="text"
              value={item.name}
              placeholder="np. Ryż biały ugotowany"
              onInput={(e) => onChange({ ...item, name: e.currentTarget.value })}
            />
          </div>
          <div class="field">
            <label class="mini-label" for={fid('portion')}>
              Porcja (opis)
            </label>
            <input
              id={fid('portion')}
              class="input compact"
              type="text"
              value={item.portion}
              placeholder="np. 1 woreczek"
              onInput={(e) => onChange({ ...item, portion: e.currentTarget.value })}
            />
          </div>
          <div class="grid-2">
            <div class="field">
              <label class="mini-label" for={fid('grams')}>
                Gramy
              </label>
              <NumberField
                id={fid('grams')}
                value={item.grams}
                onFocus={() => {
                  base.current = item;
                }}
                onValue={(g) => onChange(scaleItem(base.current, g))}
              />
            </div>
            <div class="field">
              <label class="mini-label" for={fid('kcal')}>
                Kalorie
              </label>
              <NumberField id={fid('kcal')} value={item.kcal} onValue={(kcal) => onChange({ ...item, kcal })} />
            </div>
          </div>
          <div class="grid-3">
            <div class="field">
              <label class="mini-label" for={fid('protein')}>
                Białko g
              </label>
              <NumberField
                id={fid('protein')}
                value={item.protein}
                decimals={1}
                onValue={(protein) => onChange({ ...item, protein })}
              />
            </div>
            <div class="field">
              <label class="mini-label" for={fid('fat')}>
                Tłuszcz g
              </label>
              <NumberField id={fid('fat')} value={item.fat} decimals={1} onValue={(fat) => onChange({ ...item, fat })} />
            </div>
            <div class="field">
              <label class="mini-label" for={fid('carbs')}>
                Węgl. g
              </label>
              <NumberField
                id={fid('carbs')}
                value={item.carbs}
                decimals={1}
                onValue={(carbs) => onChange({ ...item, carbs })}
              />
            </div>
          </div>
          <div class="small muted">Zmiana gramów przelicza kalorie i makroskładniki.</div>
          <button type="button" class="btn btn-danger" onClick={onDelete}>
            <Icon name="trash" size={20} />
            Usuń składnik
          </button>
        </div>
      )}
    </div>
  );
}
