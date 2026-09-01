import { describe, expect, it } from 'vitest'
import {
  type Facts,
  FAST,
  KNOWN_BOX,
  MAX_BOX,
  MAX_NEW,
  NEW_PER_LEARN,
  SESSION_SIZE,
  applyAnswer,
  buildLearnSession,
  buildSession,
  buildTimedSession,
  buildWeakSession,
  gradeAnswer,
  key,
  parseNumber,
  schedule,
  stats,
} from './tables'

const NOW = Date.UTC(2026, 8, 1)
const DAY = 86_400_000

/** Facts opbouwen uit een korte beschrijving: [a, b, box, dagen tot herhaling]. */
function facts(...rijen: [number, number, number, number][]): Facts {
  return Object.fromEntries(
    rijen.map(([a, b, box, dueIn]) => [key(a, b), { a, b, box, due: NOW + dueIn * DAY }]),
  )
}

describe('gradeAnswer', () => {
  it('rekent fout af, hoe snel ook', () => {
    expect(gradeAnswer(27, 28, 100)).toBe('fout')
    expect(gradeAnswer(null, 28, 100)).toBe('fout')
  })

  it('scheidt uit het hoofd weten van uitrekenen', () => {
    expect(gradeAnswer(28, 28, FAST - 1)).toBe('vlot')
    expect(gradeAnswer(28, 28, FAST + 1)).toBe('traag')
  })
})

describe('schedule', () => {
  it('klimt een box bij een vlot antwoord en plant verder vooruit', () => {
    const box1 = schedule(0, 'vlot', NOW)
    expect(box1).toEqual({ box: 1, due: NOW + 1 * DAY })
    expect(schedule(1, 'vlot', NOW)).toEqual({ box: 2, due: NOW + 2 * DAY })
    expect(schedule(4, 'vlot', NOW)).toEqual({ box: 5, due: NOW + 16 * DAY })
  })

  it('klimt niet boven de hoogste box', () => {
    expect(schedule(MAX_BOX, 'vlot', NOW).box).toBe(MAX_BOX)
  })

  it('laat een traag antwoord staan, maar tilt een nieuwe som naar box 1', () => {
    expect(schedule(0, 'traag', NOW)).toEqual({ box: 1, due: NOW + 1 * DAY })
    expect(schedule(3, 'traag', NOW)).toEqual({ box: 3, due: NOW + 4 * DAY })
  })

  it('zet een fout antwoord terug op box 1', () => {
    expect(schedule(5, 'fout', NOW)).toEqual({ box: 1, due: NOW + 1 * DAY })
  })

  // Dit ging in de vorige versie mis: `due` telde vragen binnen de sessie in plaats
  // van tijd, waardoor de spreiding tussen dagen niet bestond.
  it('plant altijd in de toekomst, gemeten in echte tijd', () => {
    for (const g of ['vlot', 'traag', 'fout'] as const) {
      expect(schedule(2, g, NOW).due).toBeGreaterThan(NOW)
    }
  })
})

describe('applyAnswer', () => {
  it('maakt een som aan die nog niet bestond', () => {
    const next = applyAnswer({}, 4, 7, 'vlot', NOW)
    expect(next[key(4, 7)]).toEqual({ a: 4, b: 7, box: 1, due: NOW + DAY })
  })

  it('raakt de andere sommen niet aan', () => {
    const start = facts([4, 7, 3, 0], [2, 2, 1, 0])
    const next = applyAnswer(start, 4, 7, 'fout', NOW)
    expect(next[key(2, 2)]).toBe(start[key(2, 2)])
    expect(start[key(4, 7)].box).toBe(3) // origineel ongemoeid
  })

  it('laat een goed antwoord buiten het schema niets veranderen', () => {
    const start = facts([4, 7, 3, 5])
    expect(applyAnswer(start, 4, 7, 'vlot', NOW, true)).toBe(start)
    expect(applyAnswer(start, 4, 7, 'traag', NOW, true)).toBe(start)
  })

  it('laat een fout antwoord buiten het schema wel tellen', () => {
    const start = facts([4, 7, 3, 5])
    expect(applyAnswer(start, 4, 7, 'fout', NOW, true)[key(4, 7)].box).toBe(1)
  })
})

describe('buildSession', () => {
  it('neemt alleen wat vervallen is, plus nieuwe sommen', () => {
    const f = facts([2, 1, 2, -1], [2, 2, 2, +5])
    const sessie = buildSession(f, [2], NOW)
    const gekozen = sessie.map((x) => key(x.a, x.b))
    expect(gekozen).toContain(key(2, 1)) // vervallen
    expect(gekozen).not.toContain(key(2, 2)) // pas over 5 dagen
    expect(sessie.length).toBe(1 + MAX_NEW) // die ene herhaling plus het plafond nieuwe
  })

  it('houdt het aantal nieuwe sommen per sessie beperkt', () => {
    expect(buildSession({}, [3, 4, 6], NOW).length).toBe(MAX_NEW)
  })

  it('laat herhalingen de rest van de sessie vullen', () => {
    const veel = facts(
      ...Array.from({ length: 12 }, (_, i): [number, number, number, number] => [2, i + 1, 2, -1]),
      ...Array.from({ length: 12 }, (_, i): [number, number, number, number] => [5, i + 1, 2, -1]),
    )
    expect(buildSession(veel, [2, 5], NOW).length).toBe(SESSION_SIZE)
  })

  it('blijft binnen de gekozen tafels', () => {
    const sessie = buildSession({}, [3], NOW)
    expect(sessie.every((f) => f.a === 3)).toBe(true)
  })

  it('begint bij een lege stand met de makkelijkste sommen', () => {
    const sessie = buildSession({}, [7], NOW)
    // 7×1, 7×2 en 7×10 horen bij de eerste die ze te zien krijgt.
    for (const b of [1, 2, 10]) {
      expect(sessie.some((f) => f.b === b)).toBe(true)
    }
    expect(sessie.some((f) => f.b === 12)).toBe(false) // de moeilijkste nog niet
  })

  it('geeft niets terug als alles op schema zit', () => {
    const alles = facts(...Array.from({ length: 12 }, (_, i): [number, number, number, number] => [2, i + 1, 3, 5]))
    expect(buildSession(alles, [2], NOW)).toEqual([])
  })
})

describe('buildLearnSession', () => {
  it('introduceert hooguit een handvol nieuwe sommen tegelijk', () => {
    const sessie = buildLearnSession({}, 6)
    expect(sessie.length).toBe(NEW_PER_LEARN)
    expect(sessie.every((f) => f.a === 6)).toBe(true)
  })

  it('begint met de makkelijkste en houdt die volgorde aan', () => {
    expect(buildLearnSession({}, 6).map((f) => f.b)).toEqual([1, 2, 10, 5])
  })

  it('verweeft nieuwe sommen met herhaling van dezelfde tafel', () => {
    const bekend = facts(
      [6, 1, 2, 0], [6, 2, 2, 0], [6, 10, 2, 0], [6, 5, 2, 0], [6, 3, 2, 0], [6, 4, 2, 0],
    )
    const sessie = buildLearnSession(bekend, 6)
    expect(sessie[0].box).toBe(0) // een nieuwe voorop
    expect(sessie.some((f) => f.box > 0)).toBe(true) // maar niet alleen nieuwe
  })
})

describe('buildWeakSession', () => {
  it('neemt de wankelste sommen eerst en laat gekende links liggen', () => {
    const f = facts([3, 4, 1, 0], [3, 5, KNOWN_BOX, 0], [3, 6, 2, 0])
    const gekozen = buildWeakSession(f, [3]).map((x) => key(x.a, x.b))
    expect(gekozen).toContain(key(3, 4))
    expect(gekozen).toContain(key(3, 6))
    expect(gekozen).not.toContain(key(3, 5))
  })

  it('geeft niets terug zonder zwakke sommen, zodat de app kan terugvallen', () => {
    expect(buildWeakSession({}, [3])).toEqual([])
  })
})

describe('buildTimedSession', () => {
  it('gebruikt liefst alleen sommen die ze al zag', () => {
    const f = facts(
      [2, 1, 2, 0], [2, 2, 2, 0], [2, 3, 2, 0], [2, 4, 2, 0], [2, 5, 2, 0], [2, 6, 2, 0],
    )
    expect(buildTimedSession(f, [2]).every((x) => x.box > 0)).toBe(true)
  })

  it('valt terug op alles als ze er nog te weinig zag om een minuut te vullen', () => {
    expect(buildTimedSession(facts([2, 1, 2, 0]), [2]).length).toBe(12)
  })
})

describe('stats', () => {
  it('telt te herhalen, nieuw en gekend uit elkaar', () => {
    const f = facts([2, 1, 2, -1], [2, 2, KNOWN_BOX, 5])
    expect(stats(f, [2], NOW)).toEqual({ teHerhalen: 1, nieuw: 10, gekend: 1, totaal: 12 })
  })
})

describe('parseNumber', () => {
  it('leest cijfers', () => {
    expect(parseNumber('28')).toBe(28)
    expect(parseNumber('144')).toBe(144)
  })

  it('neemt het laatste getal als ze de vraag mee uitspreekt', () => {
    expect(parseNumber('4 keer 7 is 28')).toBe(28)
  })

  it('leest Nederlandse getalwoorden', () => {
    expect(parseNumber('twaalf')).toBe(12)
    expect(parseNumber('achtentwintig')).toBe(28)
    expect(parseNumber('vierentwintig')).toBe(24)
    expect(parseNumber('negenentachtig')).toBe(89)
  })

  it('leest getalwoorden met accenten en spaties', () => {
    expect(parseNumber('drieëntwintig')).toBe(23)
    expect(parseNumber('  Zevenenzestig ')).toBe(67)
    expect(parseNumber('twee­enveertig')).toBe(42)
  })

  it('leest de honderdtallen tot 144', () => {
    expect(parseNumber('honderd')).toBe(100)
    expect(parseNumber('honderdvierenveertig')).toBe(144)
    expect(parseNumber('honderd vierenveertig')).toBe(144)
    expect(parseNumber('honderdtwintig')).toBe(120)
    expect(parseNumber('honderdeneen')).toBe(101)
  })

  it('geeft null bij iets wat geen getal is', () => {
    expect(parseNumber('weet ik niet')).toBeNull()
    expect(parseNumber('')).toBeNull()
    expect(parseNumber('bwaah')).toBeNull()
  })
})
