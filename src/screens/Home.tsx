import { useState } from 'react'
import { type Facts, TABLES, getFact, stats } from '../tables'

export type Mode = 'leren' | 'oefenen' | 'moeilijk' | 'tijd'

type Props = {
  facts: Facts
  tables: number[]
  onToggleTable: (n: number) => void
  onStart: (mode: Mode, table?: number) => void
  onProgress: () => void
}

export default function Home({ facts, tables, onToggleTable, onStart, onProgress }: Props) {
  // Eén keer per bezoek aan dit scherm vastleggen; Home wordt opnieuw opgebouwd
  // zodra ze uit een oefensessie terugkomt, dus de telling blijft actueel.
  const [nu] = useState(() => Date.now())
  const s = stats(facts, tables, nu)
  const [kiestTafel, setKiestTafel] = useState(false)

  // Hoeveel sommen van een tafel ze nog nooit zag — laat zien waar nog werk ligt.
  const nieuwIn = (n: number) => TABLES.filter((b) => getFact(facts, n, b).box === 0).length

  if (kiestTafel) {
    return (
      <div className="mx-auto max-w-md p-4">
        <h1 className="mt-4 mb-6 text-center text-2xl font-bold">Welke tafel wil je leren?</h1>
        <div className="mb-4 grid grid-cols-3 gap-2 rounded-2xl bg-white p-4 shadow-sm">
          {TABLES.map((n) => (
            <button
              key={n}
              onClick={() => onStart('leren', n)}
              className="rounded-xl bg-slate-100 py-4 text-lg font-semibold text-slate-700"
            >
              {n}
              <span className="block text-xs font-normal text-slate-500">
                {nieuwIn(n) === 0 ? 'gezien' : `${nieuwIn(n)} nieuw`}
              </span>
            </button>
          ))}
        </div>
        <button onClick={() => setKiestTafel(false)} className="w-full py-3 text-slate-500">
          ← Terug
        </button>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-md p-4">
      <h1 className="mt-4 mb-6 text-center text-2xl font-bold">🎲 Maaltafels oefenen</h1>

      <div className="mb-4 rounded-2xl bg-white p-4 shadow-sm">
        <h2 className="mb-3 font-semibold">Welke tafels oefen je?</h2>
        <div className="grid grid-cols-6 gap-2">
          {TABLES.map((n) => (
            <button
              key={n}
              onClick={() => onToggleTable(n)}
              aria-pressed={tables.includes(n)}
              className={`rounded-xl py-3 text-lg font-semibold ${
                tables.includes(n) ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700'
              }`}
            >
              {n}
            </button>
          ))}
        </div>
        <p className="mt-3 text-center text-sm text-slate-500">
          {s.teHerhalen} te herhalen · {s.nieuw} nieuw · {s.gekend} vanbuiten
        </p>
      </div>

      <div className="mb-4 space-y-2">
        <ModeButton
          primary
          titel="📚 Nieuwe tafel leren"
          uitleg="Stap voor stap, met uitleg"
          onClick={() => setKiestTafel(true)}
        />
        <ModeButton
          titel="🔁 Oefenen"
          uitleg={s.teHerhalen > 0 ? `${s.teHerhalen} sommen staan klaar` : 'Slim herhalen'}
          onClick={() => onStart('oefenen')}
        />
        <ModeButton
          titel="🎯 Moeilijke sommen"
          uitleg="Alleen waar het nog niet vlot gaat"
          onClick={() => onStart('moeilijk')}
        />
        <ModeButton
          titel="⏱️ Op tijd"
          uitleg="1 minuut, zo veel mogelijk juist"
          onClick={() => onStart('tijd')}
        />
      </div>

      <button onClick={onProgress} className="w-full py-3 text-slate-500">
        📊 Mijn vooruitgang
      </button>
    </div>
  )
}

function ModeButton({
  titel,
  uitleg,
  onClick,
  primary = false,
}: {
  titel: string
  uitleg: string
  onClick: () => void
  primary?: boolean
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full rounded-2xl p-4 text-left ${
        primary ? 'bg-indigo-600 text-white' : 'bg-white text-slate-800 shadow-sm'
      }`}
    >
      <span className="block text-lg font-semibold">{titel}</span>
      <span className={`block text-sm ${primary ? 'text-indigo-100' : 'text-slate-500'}`}>
        {uitleg}
      </span>
    </button>
  )
}
