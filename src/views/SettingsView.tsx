import { useState } from 'preact/hooks';
import { Icon } from '../components/Icon';
import { NumberField } from '../components/NumberField';
import { TabBar } from '../components/TabBar';
import { MODELS, settings, updateSettings } from '../lib/settings';

function keyInputProps(value: string) {
  return {
    id: 'api-key',
    class: 'input compact',
    autoComplete: 'off',
    autoCapitalize: 'off' as const,
    spellcheck: false,
    placeholder: 'sk-ant-...',
    value,
    onChange: (e: Event) => updateSettings({ apiKey: (e.currentTarget as HTMLInputElement).value }),
  };
}

export function SettingsView() {
  const s = settings.value;
  const [showKey, setShowKey] = useState(false);

  return (
    <>
      <main class="screen with-tabbar">
        <header class="topbar" style={{ justifyContent: 'flex-start' }}>
          <h1 class="page-title">Ustawienia</h1>
        </header>

        <h2 class="section-label">Analiza AI</h2>
        <section class="card">
          <div class="field">
            <label for="api-key" style={{ fontSize: '15px', fontWeight: 600 }}>
              Klucz API Anthropic
            </label>
            <div class="row">
              {showKey ? <input type="text" {...keyInputProps(s.apiKey)} /> : <input type="password" {...keyInputProps(s.apiKey)} />}
              <button type="button" class="btn btn-outline" style={{ minHeight: '44px' }} onClick={() => setShowKey(!showKey)}>
                {showKey ? 'Ukryj' : 'Pokaż'}
              </button>
            </div>
            <div class="small muted">Klucz jest zapisany tylko na tym telefonie.</div>
          </div>
          <hr class="divider" />
          <fieldset style={{ border: 'none', margin: 0, padding: 0 }} class="stack">
            <legend style={{ fontSize: '15px', fontWeight: 600, padding: 0, marginBottom: '6px' }}>Model AI</legend>
            {MODELS.map((m) => (
              <label key={m.id} class="row" style={{ minHeight: '52px', gap: '12px' }}>
                <input
                  type="radio"
                  name="model"
                  value={m.id}
                  checked={s.model === m.id}
                  onChange={() => updateSettings({ model: m.id })}
                  style={{ width: '20px', height: '20px', margin: 0, accentColor: 'var(--accent)' }}
                />
                <span class="stack" style={{ gap: 0 }}>
                  <span style={{ fontSize: '15px', fontWeight: 600 }}>{m.label}</span>
                  <span class="small" style={{ color: 'var(--ink-secondary)' }}>
                    {m.hint}
                  </span>
                </span>
              </label>
            ))}
          </fieldset>
        </section>

        <h2 class="section-label">Cel</h2>
        <section class="card" style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <label for="goal" style={{ fontSize: '15px', fontWeight: 600 }}>
            Dzienny cel kalorii
          </label>
          <div class="row">
            <div style={{ width: '96px' }}>
              <NumberField
                id="goal"
                value={s.dailyGoal}
                onValue={(n) => n >= 500 && n <= 10000 && updateSettings({ dailyGoal: n })}
              />
            </div>
            <span class="muted">kcal</span>
          </div>
        </section>

        <section class="notice">
          <div class="notice-title">
            <Icon name="info" size={16} />
            Prywatność
          </div>
          <p style={{ margin: 0 }}>
            Dziennik i klucz są zapisane tylko na tym telefonie. Opis i zdjęcia trafiają do Anthropic wyłącznie w chwili
            analizy.
          </p>
        </section>
      </main>
      <div class="bottom">
        <TabBar active="settings" />
      </div>
    </>
  );
}
