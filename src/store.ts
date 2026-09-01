// Opslag in localStorage. Enige plek die van persistentie weet.

import type { Facts } from './tables'

// v2 omdat v1 (de losse index.html) `due` als sessieteller bewaarde in plaats van
// als datum. Die waarden zijn niet om te rekenen, dus die opslag laten we liggen.
const KEY = 'maaltafels.v2'

export type Progress = { v: 2; tables: number[]; facts: Facts }

/** Ze is net begonnen: de tafels die daarbij horen staan meteen aan. */
export const fresh = (): Progress => ({ v: 2, tables: [1, 2, 5, 10], facts: {} })

export function load(): Progress {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return fresh()
    const p = JSON.parse(raw)
    // Alles wat niet als v2 herkenbaar is, negeren we — inclusief de oude opslag.
    if (p?.v !== 2 || !Array.isArray(p.tables) || typeof p.facts !== 'object' || !p.facts) {
      return fresh()
    }
    return { v: 2, tables: p.tables, facts: p.facts }
  } catch {
    // Corrupte opslag mag niet betekenen dat de app niet meer opstart.
    console.error('Kon de opgeslagen voortgang niet lezen, begin opnieuw.')
    return fresh()
  }
}

export function save(p: Progress): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(p))
  } catch {
    // Safari in privémodus gooit hier. Niets aan te doen, maar de app moet doorlopen.
    console.error('Kon de voortgang niet bewaren.')
  }
}
