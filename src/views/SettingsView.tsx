import { useEffect, useRef, useState } from 'preact/hooks';
import { Icon } from '../components/Icon';
import { NumberField } from '../components/NumberField';
import { TabBar } from '../components/TabBar';
import { body, updateBody } from '../lib/body';
import { clearAllData } from '../lib/db';
import { formatNumber } from '../lib/nutrition';
import { hrefs } from '../lib/router';
import { useGoal } from '../lib/usePlan';
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
    onInput: (e: Event) => updateSettings({ apiKey: (e.currentTarget as HTMLInputElement).value }),
  };
}

type Status = { kind: 'ok' | 'error' | 'busy'; text: string } | null;

function isStandalone(): boolean {
  const nav = navigator as Navigator & { standalone?: boolean };
  return window.matchMedia?.('(display-mode: standalone)').matches || nav.standalone === true;
}

export function SettingsView() {
  const s = settings.value;
  const { status } = useGoal();
  const goalSource = body.value.goalSource;
  const [showKey, setShowKey] = useState(false);
  const [keyStatus, setKeyStatus] = useState<Status>(null);
  const [dataStatus, setDataStatus] = useState<Status>(null);
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const importRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    navigator.storage?.persisted?.().then(setPersisted, () => setPersisted(null));
  }, []);

  const checkKey = async () => {
    setKeyStatus({ kind: 'busy', text: 'Sprawdzam…' });
    try {
      const { checkApiKey } = await import('../lib/analyze');
      await checkApiKey(settings.value.apiKey, settings.value.model);
      setKeyStatus({ kind: 'ok', text: 'Klucz działa i ma dostęp do wybranego modelu.' });
    } catch (e) {
      setKeyStatus({ kind: 'error', text: e instanceof Error ? e.message : String(e) });
    }
  };

  const doExport = async () => {
    try {
      const { exportBackup } = await import('../lib/backup');
      const result = await exportBackup();
      if (result !== 'cancelled') setDataStatus({ kind: 'ok', text: 'Kopia gotowa. Zachowaj plik, np. w aplikacji Pliki.' });
    } catch (e) {
      setDataStatus({ kind: 'error', text: `Nie udało się utworzyć kopii: ${e instanceof Error ? e.message : String(e)}` });
    }
  };

  const doImport = async (e: Event) => {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    try {
      const { importBackup } = await import('../lib/backup');
      const count = await importBackup(file);
      setDataStatus({ kind: 'ok', text: `Zaimportowano posiłki: ${count}.` });
    } catch (err) {
      setDataStatus({ kind: 'error', text: err instanceof Error ? err.message : String(err) });
    }
  };

  const deleteAll = async () => {
    if (!window.confirm('Usunąć wszystkie posiłki, pomiary wagi i aktywność z tego telefonu? Tego nie da się cofnąć.')) return;
    await clearAllData();
    setDataStatus({ kind: 'ok', text: 'Usunięto wszystkie dane.' });
  };

  return (
    <>
      <main class="screen with-tabbar">
        <header class="topbar" style={{ justifyContent: 'flex-start' }}>
          <h1 class="page-title">Ustawienia</h1>
        </header>

        {!isStandalone() && (
          <section class="notice">
            <div class="notice-title">
              <Icon name="phone" size={16} />
              Zainstaluj na iPhonie
            </div>
            <p style={{ margin: 0 }}>
              W Safari dotknij Udostępnij, a potem „Do ekranu początkowego”. Caloreo otworzy się jak zwykła aplikacja, na
              pełnym ekranie.
            </p>
          </section>
        )}

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
            <div class="small muted">
              Klucz utworzysz na console.anthropic.com (API Keys). Ustaw tam miesięczny limit wydatków. Klucz jest zapisany
              tylko na tym telefonie.
            </div>
            <button
              type="button"
              class="btn btn-ghost"
              style={{ alignSelf: 'flex-start', paddingLeft: 0 }}
              disabled={!s.apiKey || keyStatus?.kind === 'busy'}
              onClick={checkKey}
            >
              <Icon name="key" size={18} />
              Sprawdź klucz
            </button>
            {keyStatus && <StatusLine status={keyStatus} />}
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
                  onChange={() => {
                    updateSettings({ model: m.id });
                    setKeyStatus(null);
                  }}
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

        <h2 class="section-label">Cel kalorii</h2>
        <section class="card">
          <fieldset style={{ border: 'none', margin: 0, padding: 0 }} class="stack">
            <legend class="visually-hidden">Źródło dziennego celu kalorii</legend>
            <label class="row" style={{ minHeight: '52px', gap: '12px', opacity: status ? 1 : 0.6 }}>
              <input
                type="radio"
                name="goal-source"
                checked={goalSource === 'plan' && status !== null}
                disabled={!status}
                onChange={() => updateBody({ goalSource: 'plan' })}
                style={{ width: '20px', height: '20px', margin: 0, accentColor: 'var(--accent)' }}
              />
              <span class="stack" style={{ gap: 0 }}>
                <span style={{ fontSize: '15px', fontWeight: 600 }}>
                  Z planu wagi{status ? `: ${formatNumber(status.dailyTarget)} kcal dziś` : ''}
                </span>
                <span class="small" style={{ color: 'var(--ink-secondary)' }}>
                  {status ? 'Przelicza się po ważeniu i wpisach z Garmina.' : 'Najpierw ustaw cel w zakładce Waga.'}
                </span>
              </span>
            </label>
            <label class="row" style={{ minHeight: '52px', gap: '12px' }}>
              <input
                type="radio"
                name="goal-source"
                checked={goalSource === 'manual' || status === null}
                onChange={() => updateBody({ goalSource: 'manual' })}
                style={{ width: '20px', height: '20px', margin: 0, accentColor: 'var(--accent)' }}
              />
              <span style={{ fontSize: '15px', fontWeight: 600 }}>Ręcznie</span>
            </label>
          </fieldset>
          {(goalSource === 'manual' || status === null) && (
            <div class="row-between">
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
            </div>
          )}
          {!status && (
            <a class="small" href={hrefs.weightPlan()}>
              Ustaw plan wagi, a cel kalorii policzy się sam.
            </a>
          )}
        </section>

        <h2 class="section-label">Dane</h2>
        <section class="card" style={{ padding: '4px 14px', gap: 0 }}>
          <button type="button" class="list-btn" onClick={doExport}>
            <Icon name="download" size={20} />
            Eksportuj kopię (plik JSON)
          </button>
          <button type="button" class="list-btn" onClick={() => importRef.current?.click()}>
            <Icon name="upload" size={20} />
            Importuj kopię
          </button>
          <button type="button" class="list-btn danger" onClick={deleteAll}>
            <Icon name="trash" size={20} />
            Usuń wszystkie dane
          </button>
          <input
            ref={importRef}
            class="visually-hidden"
            type="file"
            accept="application/json,.json"
            tabIndex={-1}
            aria-hidden="true"
            onChange={doImport}
          />
        </section>
        {dataStatus && <StatusLine status={dataStatus} />}

        <section class="notice">
          <div class="notice-title">
            <Icon name="info" size={16} />
            Prywatność i kopie
          </div>
          <p style={{ margin: 0 }}>
            Dziennik i klucz są zapisane tylko na tym telefonie. Opis i zdjęcia trafiają do Anthropic wyłącznie w chwili
            analizy. Kopia zapasowa nie zawiera klucza API.
          </p>
          <p style={{ margin: 0 }}>
            Trwałe przechowywanie danych:{' '}
            {persisted === null ? 'nieznane' : persisted ? 'włączone' : 'niepotwierdzone, rób czasem kopię'}.
          </p>
        </section>
      </main>
      <div class="bottom">
        <TabBar active="settings" />
      </div>
    </>
  );
}

function StatusLine({ status }: { status: NonNullable<Status> }) {
  const color = status.kind === 'error' ? 'var(--warn)' : status.kind === 'ok' ? 'var(--accent)' : 'var(--ink-secondary)';
  return (
    <div role="status" class="row" style={{ gap: '6px', fontSize: '14px', fontWeight: 600, color, alignItems: 'flex-start' }}>
      {status.kind === 'ok' && <Icon name="check" size={16} strokeWidth={3} />}
      <span>{status.text}</span>
    </div>
  );
}
