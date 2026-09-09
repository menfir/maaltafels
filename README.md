# Maaltafels

Een oefenapp voor de maaltafels van 1 tot 12, gemaakt voor één kind in het
lager onderwijs. Draait als PWA op GitHub Pages:
<https://menfir.github.io/maaltafels/>

## Waarom

Maaltafels moeten uit het hoofd komen. Een som die je uitrekent, ken je nog
niet. Daarom plant de app niet op "goed of fout" alleen, maar telt ook de
antwoordtijd mee: te traag goed is geen goed.

De planning is een Leitner-systeem met zes boxen (wachttijd 1, 2, 4, 8, 16, 32
dagen). Juist binnen zes seconden schuift een box op, juist maar uitgerekend
blijft staan, fout gaat terug naar box 1. Vanaf box 5 geldt de som als uit het
hoofd gekend. Per sessie komen er maximaal zes
nieuwe sommen bij — zonder dat plafond krijgt ze bij een verse tafel twaalf
onbekende sommen tegelijk, en blijft er geen enkele hangen.

Het model komt uit de Frans-app van hetzelfde huishouden (`src/leitner.ts`
daar), met de antwoordtijd als enige inhoudelijke verschil.

## Oefenvormen

- **Leren** — één gekozen tafel, klein aantal nieuwe sommen
- **Oefenen** — gewone sessie van 20 sommen uit de aangevinkte tafels
- **Moeilijk** — alleen de sommen die blijven haperen
- **Tijd** — zoveel mogelijk in 60 seconden

Antwoorden kan met de knoppen of, waar de browser het ondersteunt, met de stem
(Web Speech API, gratis en zonder API key — spraakherkenning heeft wel
internet nodig).

## Stack

Vite, React 19, Tailwind 4, TypeScript. Voortgang staat in `localStorage`
(sleutel `maaltafels.v2`), er is geen backend en geen account.

De service worker doet netwerk-eerst met de cache als vangnet, zonder vaste
precache-lijst: Vite hasht assetnamen, dus zo'n lijst is bij elke build
verlopen.

## Opzet

| Bestand | Verantwoordelijkheid |
| --- | --- |
| `src/tables.ts` | Leitner-planning en sessieopbouw. Pure functies |
| `src/store.ts` | Enige plek die van `localStorage` weet |
| `src/speech.ts` | Spraakherkenning en voorlezen |
| `src/App.tsx` | Schermkeuze en state |
| `src/screens/` | Home, Quiz, Progress |

## Ontwikkelen

```bash
npm install
npm run dev      # dev-server
npm test         # vitest
npm run lint     # oxlint
npm run build    # tsc + vite build
```

Een push naar `main` bouwt en publiceert naar GitHub Pages
(`.github/workflows/deploy.yml`). `base` in `vite.config.ts` staat op
`/maaltafels/`, want de app draait in een submap van het Pages-domein.
