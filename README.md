# Caloreo

Prywatny licznik kalorii na iPhone'a. Mówisz, co zjadłeś, albo robisz zdjęcie talerza. Claude (AI od Anthropic) rozpisuje posiłek na składniki z gramami, kaloriami i makroskładnikami. Sprawdzasz wynik, poprawiasz i zapisujesz. Ekran główny pokazuje, ile zjadłeś dziś na tle dziennego celu.

To aplikacja webowa (PWA). Instaluje się z Safari na ekran początkowy, bez App Store i bez Maca.

## Funkcje

- **Dyktowanie po polsku.** Duży mikrofon na ekranie „Dziś”, tekst pojawia się na żywo i można go poprawić.
- **Zdjęcia.** Aparat lub galeria, do 4 zdjęć na posiłek (np. talerz i etykieta). Zdjęcie łączy się z opisem.
- **Analiza AI.** Każdy składnik osobno: porcja, gramy, kcal, białko, tłuszcz, węglowodany. Do tego pewność oszacowania i przyjęte założenia.
- **Weryfikacja przed zapisem.** Zmiana gramów przelicza kalorie i makro. Można dodać lub usunąć składnik albo poprawić wynik głosem („ryżu było pół woreczka”).
- **Ekran „Dziś”.** Zjedzone kalorie wobec celu, ile zostało, makroskładniki w gramach i ich udział w energii. Strzałki przechodzą do poprzednich dni.
- **Edycja i „Zjedz ponownie”.** Zapisany posiłek można poprawić, usunąć albo skopiować na dziś bez ponownej analizy.
- **Historia.** Wykres 7 lub 30 dni z linią celu, średnia i liczba dni w granicach celu.
- **Ustawienia.** Klucz API z przyciskiem „Sprawdź klucz”, wybór modelu, dzienny cel, eksport i import kopii (JSON).
- **Plan wagi** (zakładka „Waga”). Podajesz wagę obecną, docelową i datę; aplikacja liczy dzienny deficyt (albo nadwyżkę) i dzienny cel kalorii, sprawdza plan i proponuje poprawiony, gdy nie mieści się w progach. Po każdym ważeniu plan przelicza się od nowa.
- **Aktywność z Garmina.** Na ekranie „Dziś” wpisujesz kalorie aktywne dnia (wieczorem albo następnego dnia), opcjonalnie kroki. Aplikacja liczy bilans dnia, średni rzeczywisty deficyt i porównuje go z planem.
- **Bilans dnia na ekranie „Dziś”.** W karcie podsumowania, pod paskiem kalorii: spalone, zjedzone i deficyt (albo nadwyżka), porównanie z planem i średnia z 7 dni w wierszu planu. Przed wpisaniem danych z Garmina bilans jest szacunkiem z prognozą na koniec dnia.
- **Tryb ciemny** zgodny z ustawieniem iPhone'a.

Domyślne ustawienia:

- **Model:** Claude Haiku 5.5. W ustawieniach można przełączyć na Sonnet 5.5 albo Opus 5.5.
- **Cel:** 2100 kcal. To wzór Mifflin-St Jeor dla 80 kg, 183 cm, 36 lat (ok. 1770 kcal w spoczynku) razy 1,2 przy siedzącym trybie życia.

## Plan wagi: jak liczę

1. **Podstawa** = przemiana spoczynkowa (wzór Mifflin-St Jeor) × 1,2, czyli dzień bez treningów.
2. **Spalone dnia** = podstawa + kalorie aktywne z Garmina.
3. **Bilans dnia** = spalone − zjedzone (dodatni to deficyt).
4. **Potrzebny deficyt** = (waga teraz − docelowa) × 7 700 kcal ÷ dni do celu (przy przybieraniu to nadwyżka).
5. **Dzienny cel jedzenia** = podstawa + średnia aktywność − potrzebny deficyt.
   - Średnia aktywność pochodzi z wpisów z ostatnich 14 dni, gdy jest ich co najmniej 7.
   - Wcześniej szacuję ją z poziomu aktywności podanego w profilu.
6. **Bilans na teraz** (dzień bez wpisu z Garmina):
   - kalorie aktywne to średnia z ostatnich 7 dni, gdy są w nich co najmniej 3 wpisy, a wcześniej poziom aktywności z profilu;
   - prognoza na koniec dnia zakłada, że zjesz resztę dziennego celu.

Progi sprawdzania planu:

| Reguła | Redukcja | Przybieranie |
|---|---|---|
| Tempo | maks. 1% masy ciała z początku planu na tydzień | maks. 0,5% na tydzień |
| Dzienny cel | min. 1 500 kcal (M), 1 200 kcal (K) | bez dolnego progu |
| Deficyt lub nadwyżka | maks. 1 000 kcal dziennie | maks. 500 kcal dziennie |
| Waga docelowa | BMI co najmniej 18,5 | BMI poniżej 30 |
| Data celu | co najmniej 7 dni od dziś | co najmniej 7 dni od dziś |

Gdy plan nie mieści się w progach, aplikacja proponuje późniejszą datę albo mniejszą zmianę wagi. Własny plan można zapisać po potwierdzeniu.

- Jeśli po ważeniu plan wymaga zbyt szybkiego tempa, dzienny cel zostaje w progach, a aplikacja proponuje przesunięcie daty.
- Wyjątkiem jest plan zapisany mimo ostrzeżenia: wtedy cel nie jest ograniczany.

[Unverified] 7 700 kcal na kilogram i progi to ogólne, często podawane przybliżenia, nie porada medyczna.

## Instalacja na iPhonie

1. **Klucz API.**
   - Na [console.anthropic.com](https://console.anthropic.com) utwórz klucz w sekcji API Keys i doładuj konto.
   - API rozlicza się osobno od subskrypcji Claude.
   - Warto ustawić miesięczny limit wydatków.
2. **Otwórz aplikację.** Wejdź w Safari na <https://zephyr1990.github.io/caloreo/> (po włączeniu GitHub Pages, patrz niżej).
3. **Dodaj do ekranu początkowego.** Dotknij Udostępnij, potem „Do ekranu początkowego”.
4. **Wklej klucz.** Otwórz Caloreo z ikony, przejdź do Ustawień, wklej klucz i dotknij „Sprawdź klucz”.

### Jednorazowe włączenie GitHub Pages

1. Scal gałąź z kodem do `main`.
2. W repozytorium wejdź w **Settings → Pages → Build and deployment → Source** i wybierz **GitHub Actions**.
3. Workflow **Deploy to GitHub Pages** zbuduje i opublikuje aplikację po każdym pushu do `main`. Można go też uruchomić ręcznie w zakładce Actions.

Adres jest publiczny, ale w kodzie nie ma żadnego klucza. Bez własnego klucza aplikacja nic nie analizuje.

## Koszty AI

[Inference] Poniższe kwoty to szacunek z typowego rozmiaru zdjęcia i odpowiedzi, nie pomiar. Ceny za 1 mln tokenów (wejście / wyjście) pochodzą z cennika Anthropic.

| Model | Cena | Posiłek ze zdjęciem | Miesiąc (4 posiłki dziennie) |
|---|---|---|---|
| Haiku 5.5 (domyślny) | $0,10 / $0,50 | poniżej $0,002 | poniżej $0,50 |
| Sonnet 5.5 | $2 / $10 | ok. $0,015-0,03 | ok. $2-4 |
| Opus 5.5 | $4 / $20 | ok. $0,03-0,06 | ok. $4-7 |

Zdjęcia są pomniejszane do 1568 px przed wysłaniem. Opis bez zdjęcia kosztuje mniej.

## Prywatność

- **Dziennik i klucz API** są zapisane tylko w pamięci przeglądarki na telefonie (IndexedDB i localStorage). Nie ma własnego serwera.
- **Opis i zdjęcia** trafiają bezpośrednio do API Anthropic, wyłącznie w chwili analizy. W dzienniku zostaje mała miniatura pierwszego zdjęcia.
- **Kopia zapasowa** (Ustawienia → Eksportuj kopię) obejmuje posiłki, pomiary wagi, aktywność i plan, ale nie zawiera klucza API.
- **Nowe wersje** podmieniają tylko kod aplikacji. Dane w pamięci telefonu zostają, a zmiany bazy tylko dodają nowe zbiory.

## Znane ograniczenia i rzeczy do sprawdzenia

- **Mikrofon w trybie aplikacji.** [Unverified] Rozpoznawanie mowy z przeglądarki (Web Speech API) na iOS może być niedostępne po dodaniu do ekranu początkowego. Wtedy aplikacja pokaże komunikat, a zapasem jest mikrofon na klawiaturze iOS (dyktowanie), jeśli jest włączone w ustawieniach.
- **Testy.** Automatyczne testy działają w Chromium w rozmiarze iPhone'a, z symulowanym API i symulowanym rozpoznawaniem mowy. Na prawdziwym iPhonie i z prawdziwym API aplikacja nie była jeszcze testowana.
- **Dokładność.** [Inference] Szacunki ze zdjęć mogą odbiegać od rzeczywistości, szczególnie przy porcjach i ukrytym tłuszczu. Do tego służą ekran weryfikacji i podawanie gramów.
- **Trwałość danych.** [Unverified] Safari w pewnych warunkach może usunąć dane stron. Aplikacja prosi o trwałe przechowywanie, a status widać w Ustawieniach. Warto co jakiś czas eksportować kopię.
- **Apple Health i Garmin Connect.** Aplikacja webowa nie ma do nich dostępu, dlatego kalorie aktywne i kroki wpisuje się ręcznie.
- **Edycja planu.** Zapisanie planu na nowo zaczyna go od dzisiejszej wagi, więc postęp liczy się od nowa. Pomiary i bilans zostają.

## Rozwój

Wymagany Node.js 22.

```bash
npm install
npm run dev          # serwer deweloperski
npm run typecheck    # TypeScript
npm test             # testy jednostkowe (Vitest)
npm run test:e2e     # testy przeglądarkowe (Playwright, Chromium)
npm run build        # wersja produkcyjna w dist/
```

- **Chromium spoza Playwrighta:** `CHROMIUM_PATH=/ścieżka/do/chromium npm run test:e2e`.
- **Ikony:** `node scripts/generate-icons.mjs` generuje PNG z plików SVG w `public/`.

### Struktura

```
src/
  app.tsx              routing między ekranami
  views/               ekrany: Dziś, Nowy posiłek, Posiłek, Historia, Waga, Cel wagi, Ustawienia
  components/          edytor posiłku, podsumowanie dnia, mikrofon, ikony
  lib/
    analyze.ts         zapytanie do Claude (SDK Anthropic, odpowiedź JSON wg schematu, prompt)
    speech.ts          rozpoznawanie mowy (pl-PL)
    image.ts           pomniejszanie zdjęć i miniatury
    db.ts              zapis posiłków w IndexedDB
    nutrition.ts       sumy, przeliczanie gramów, udział makro
    weightPlan.ts      plan wagi: zapotrzebowanie, progi, propozycje, bilans
    body.ts            profil, plan i źródło celu kalorii
    history.ts         statystyki do historii
    backup.ts          eksport i import kopii
tests/                 testy jednostkowe
e2e/                   testy Playwright
```

Technologie: Vite, Preact, TypeScript, vite-plugin-pwa (service worker i manifest), idb, zod, @anthropic-ai/sdk.
