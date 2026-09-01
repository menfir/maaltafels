import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fresh, load, save } from './store'

// localStorage bestaat niet in Node. Een Map volstaat: we testen onze eigen laag,
// niet die van de browser.
beforeEach(() => {
  const map = new Map<string, string>()
  Object.defineProperty(globalThis, 'localStorage', {
    value: {
      getItem: (k: string) => map.get(k) ?? null,
      setItem: (k: string, v: string) => map.set(k, v),
      removeItem: (k: string) => map.delete(k),
    },
    configurable: true,
  })
})

describe('opslag', () => {
  it('begint leeg met de tafels van een beginner', () => {
    expect(load()).toEqual({ v: 2, tables: [1, 2, 5, 10], facts: {} })
  })

  it('overleeft een heen-en-terugreis', () => {
    const p = { v: 2 as const, tables: [3, 7], facts: { '3x7': { a: 3, b: 7, box: 4, due: 123 } } }
    save(p)
    expect(load()).toEqual(p)
  })

  it('bewaart de voortgang tussen sessies', () => {
    save({ ...fresh(), facts: { '2x2': { a: 2, b: 2, box: 3, due: 999 } } })
    expect(load().facts['2x2'].box).toBe(3)
  })

  it('valt terug op een verse staat bij corrupte opslag', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    localStorage.setItem('maaltafels.v2', '{dit is geen json')
    expect(load()).toEqual(fresh())
  })

  it('negeert opslag van een vorige versie in plaats van erop te crashen', () => {
    // Zo zag v1 eruit: `due` was een sessieteller, niet een datum. Onbruikbaar.
    localStorage.setItem('maaltafels.v2', JSON.stringify({ tables: [2], facts: { '2x3': { lvl: 4, due: 34 } } }))
    expect(load()).toEqual(fresh())
  })

  it('negeert opslag met de juiste versie maar de verkeerde vorm', () => {
    localStorage.setItem('maaltafels.v2', JSON.stringify({ v: 2, tables: 'alles', facts: {} }))
    expect(load()).toEqual(fresh())
  })

  it('zet alles terug op de beginstand bij een reset', () => {
    save({ ...fresh(), tables: [7], facts: { '7x7': { a: 7, b: 7, box: 5, due: 1 } } })
    save(fresh())
    expect(load()).toEqual(fresh())
  })

  it('laat de app doorlopen als bewaren niet mag', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    Object.defineProperty(globalThis, 'localStorage', {
      value: {
        getItem: () => null,
        setItem: () => {
          throw new Error('QuotaExceededError') // Safari in privémodus
        },
        removeItem: () => {},
      },
      configurable: true,
    })
    expect(() => save(fresh())).not.toThrow()
  })
})
