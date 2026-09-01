// Leitner-planning, sessieopbouw en getalherkenning. Pure functies, geen React,
// geen localStorage. Model overgenomen van de Frans-app (src/leitner.ts), met één
// inhoudelijk verschil: hier telt ook de antwoordtijd mee. Een maaltafel moet uit
// het hoofd komen; wie het antwoord uitrekent, kent ze nog niet.

/** Eén som. `box` 0 = nog nooit gezien, daarna 1..MAX_BOX. `due` is epoch ms. */
export type Fact = { a: number; b: number; box: number; due: number }
/** Sleutel `${a}x${b}` — de sleutelruimte ligt vast, dus een Record scheelt zoekwerk. */
export type Facts = Record<string, Fact>

export const MAX_TABLE = 12
export const TABLES = Array.from({ length: MAX_TABLE }, (_, i) => i + 1)

const DAY = 86_400_000
/** Wachttijd per box, in dagen. Index = box; box 0 bestaat niet als wachttijd. */
const INTERVALS = [0, 1, 2, 4, 8, 16, 32]
export const MAX_BOX = INTERVALS.length - 1
/** Vanaf deze box zeggen we dat ze de som vanbuiten kent. */
export const KNOWN_BOX = 5

export const SESSION_SIZE = 20
/**
 * Nieuwe sommen per gewone oefensessie. Zonder plafond krijgt ze bij een verse tafel
 * twaalf onbekende sommen tegelijk voorgeschoteld; er blijft er dan geen enkele hangen.
 */
export const MAX_NEW = 6
/** Nieuwe sommen per leersessie — daar ligt de nadruk op leren, maar het plafond blijft laag. */
export const NEW_PER_LEARN = 4
export const TIMED_MS = 60_000

/**
 * Boven deze tijd rekende ze het uit in plaats van het te weten.
 * ponytail: afstelknop. 6s past bij een beginner; zet lager naarmate ze vlotter wordt.
 */
export const FAST = 6000

/** Volgorde waarin nieuwe sommen binnen een tafel aan bod komen: makkelijk eerst. */
const INTRO_ORDER = [1, 2, 10, 5, 3, 4, 11, 6, 7, 8, 9, 12]

export const key = (a: number, b: number) => `${a}x${b}`
export const product = (f: Fact) => f.a * f.b

export function newFact(a: number, b: number): Fact {
  return { a, b, box: 0, due: 0 }
}

/** De som zoals ze in de opslag staat, of een verse als ze nog nooit gesteld is. */
export const getFact = (facts: Facts, a: number, b: number): Fact =>
  facts[key(a, b)] ?? newFact(a, b)

// -------------------------------------------------------------------- planning

export type Grade = 'vlot' | 'traag' | 'fout'

/**
 * 'vlot'  — juist en binnen FAST: dit kent ze uit het hoofd
 * 'traag' — juist, maar uitgerekend; telt als gekend genoeg om te blijven staan
 * 'fout'  — verkeerd
 */
export function gradeAnswer(given: number | null, expected: number, ms: number): Grade {
  if (given !== expected) return 'fout'
  return ms <= FAST ? 'vlot' : 'traag'
}

/** Nieuwe box + vervaldatum na een antwoord. Muteert niets. */
export function schedule(box: number, g: Grade, now: number): { box: number; due: number } {
  // 'traag' klimt niet, maar tilt een nieuwe som wél naar box 1 — anders blijft ze
  // eeuwig als "nieuw" meetellen en komt ze elke sessie opnieuw als nieuw bovendrijven.
  const next = g === 'vlot' ? Math.min(box + 1, MAX_BOX) : g === 'traag' ? Math.max(1, box) : 1
  return { box: next, due: now + INTERVALS[next] * DAY }
}

/**
 * Past een antwoord toe en geeft een nieuwe Facts terug.
 *
 * `extra` = oefenen buiten het schema. Dan tellen alleen fouten: een goed antwoord
 * verandert niets. Anders klikt ze zich in één zitting naar box 6 en komt de som een
 * maand niet meer terug zonder dat ze die beter kent.
 */
export function applyAnswer(
  facts: Facts,
  a: number,
  b: number,
  g: Grade,
  now: number,
  extra = false,
): Facts {
  if (extra && g !== 'fout') return facts
  const fact = getFact(facts, a, b)
  return { ...facts, [key(a, b)]: { ...fact, ...schedule(fact.box, g, now) } }
}

// --------------------------------------------------------------- sessieopbouw

function shuffle<T>(items: T[]): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/** Alle sommen van de gekozen tafels, of ze nu al gezien zijn of niet. */
function pool(facts: Facts, tables: number[]): Fact[] {
  return tables.flatMap((a) => TABLES.map((b) => getFact(facts, a, b)))
}

const byDue = (x: Fact, y: Fact) => x.due - y.due
const byIntro = (x: Fact, y: Fact) => INTRO_ORDER.indexOf(x.b) - INTRO_ORDER.indexOf(y.b)

/**
 * Gewone oefensessie: vervallen herhalingen aangevuld met nieuwe sommen.
 *
 * Zonder die verdeling verdrinken de nieuwe sommen in de achterstand van alles wat ze
 * al eens zag — of komen de oude juist nooit meer aan bod.
 */
export function buildSession(facts: Facts, tables: number[], now: number): Fact[] {
  const items = pool(facts, tables)
  const reviews = items.filter((f) => f.box > 0 && f.due <= now).sort(byDue)
  // Nieuwe sommen eerst plafonneren; herhalingen vullen de rest van de sessie op.
  const nieuw = items.filter((f) => f.box === 0).sort(byIntro).slice(0, MAX_NEW)
  return shuffle([...reviews.slice(0, SESSION_SIZE - nieuw.length), ...nieuw])
}

/**
 * Nieuwe tafel leren: één tafel, hooguit NEW_PER_LEARN nieuwe sommen, aangevuld met
 * herhaling uit diezelfde tafel. Niet geschud — de nieuwe sommen komen in oplopende
 * moeilijkheid, zodat ze op de makkelijke kan voortbouwen.
 */
export function buildLearnSession(facts: Facts, table: number): Fact[] {
  const items = pool(facts, [table])
  const fresh = items.filter((f) => f.box === 0).sort(byIntro).slice(0, NEW_PER_LEARN)
  const rest = shuffle(items.filter((f) => f.box > 0).sort(byDue).slice(0, SESSION_SIZE))
  // Nieuwe som, dan wat herhaling, dan de volgende nieuwe: verweven onthoudt beter
  // dan alle nieuwe achter elkaar.
  const out: Fact[] = []
  for (const f of fresh) out.push(f, ...rest.splice(0, 3))
  return [...out, ...rest].slice(0, SESSION_SIZE)
}

/**
 * Oefenen buiten het schema, voor als er niets vervallen is en ze toch wil oefenen.
 * Neemt de sommen die het dichtst bij hun herhaling zitten — die zijn het wankelst.
 */
export function buildExtraSession(facts: Facts, tables: number[]): Fact[] {
  return shuffle(pool(facts, tables).sort(byDue).slice(0, SESSION_SIZE))
}

/** Op tijd: alleen sommen die ze al eens zag, anders is het raden tegen een klok. */
export function buildTimedSession(facts: Facts, tables: number[]): Fact[] {
  const seen = pool(facts, tables).filter((f) => f.box > 0)
  return shuffle(seen.length >= 5 ? seen : pool(facts, tables))
}

/** Moeilijke sommen: laagste box eerst, en enkel wat ze al zag. */
export function buildWeakSession(facts: Facts, tables: number[]): Fact[] {
  const zwak = pool(facts, tables)
    .filter((f) => f.box > 0 && f.box < KNOWN_BOX)
    .sort((x, y) => x.box - y.box || x.due - y.due)
  return shuffle(zwak.slice(0, SESSION_SIZE))
}

/** Aantallen voor het startscherm. */
export function stats(facts: Facts, tables: number[], now: number) {
  const items = pool(facts, tables)
  return {
    teHerhalen: items.filter((f) => f.box > 0 && f.due <= now).length,
    nieuw: items.filter((f) => f.box === 0).length,
    gekend: items.filter((f) => f.box >= KNOWN_BOX).length,
    totaal: items.length,
  }
}

// ----------------------------------------------------------- getalherkenning

const WOORDEN: Record<string, number> = {
  nul: 0, een: 1, twee: 2, drie: 3, vier: 4, vijf: 5, zes: 6, zeven: 7, acht: 8,
  negen: 9, tien: 10, elf: 11, twaalf: 12, dertien: 13, veertien: 14, vijftien: 15,
  zestien: 16, zeventien: 17, achttien: 18, negentien: 19, twintig: 20, dertig: 30,
  veertig: 40, vijftig: 50, zestig: 60, zeventig: 70, tachtig: 80, negentig: 90,
}
const TIENTALLEN = 'twintig|dertig|veertig|vijftig|zestig|zeventig|tachtig|negentig'

/** Kleine letters, accenten weg, alles wat geen letter of cijfer is weg. */
const kaal = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/[^a-z0-9]/g, '')

/** Getalwoord onder de honderd: "twaalf", "vierentwintig". */
function onderHonderd(s: string): number | null {
  if (s in WOORDEN) return WOORDEN[s]
  const m = s.match(new RegExp(`^(.+?)en(${TIENTALLEN})$`))
  return m && m[1] in WOORDEN ? WOORDEN[m[1]] + WOORDEN[m[2]] : null
}

/**
 * Leest een gesproken of getypt antwoord als getal, of null als er geen in zit.
 *
 * Spraakherkenning levert soms cijfers ("28"), soms woorden ("achtentwintig"), en
 * soms de hele vraag mee ("4 keer 7 is 28") — dan is het láátste getal het antwoord.
 */
export function parseNumber(text: string): number | null {
  const cijfers = text.match(/\d+/g)
  if (cijfers) return Number(cijfers[cijfers.length - 1])

  const s = kaal(text)
  if (!s) return null
  if (s === 'honderd') return 100
  // Producten lopen tot 144, dus honderdtallen alleen als "honderd" + rest.
  const rest = s.startsWith('honderd') ? s.slice('honderd'.length).replace(/^en/, '') : null
  if (rest !== null) {
    const n = onderHonderd(rest)
    return n === null ? null : 100 + n
  }
  return onderHonderd(s)
}
