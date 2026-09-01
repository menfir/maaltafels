import { type Facts, KNOWN_BOX, MAX_BOX, TABLES, getFact } from '../tables'

/** Kleur per box: van "nog nooit gezien" naar "kent ze vanbuiten". */
const KLEUR = [
  'bg-slate-100 text-slate-300',
  'bg-rose-200',
  'bg-orange-200',
  'bg-amber-200',
  'bg-lime-200',
  'bg-green-300',
  'bg-emerald-400',
]

export default function Progress({
  facts,
  onBack,
  onReset,
}: {
  facts: Facts
  onBack: () => void
  onReset: () => void
}) {
  const alle = TABLES.flatMap((a) => TABLES.map((b) => getFact(facts, a, b)))
  const gekend = alle.filter((f) => f.box >= KNOWN_BOX).length

  return (
    <div className="mx-auto max-w-md p-4">
      <h1 className="mt-4 mb-4 text-center text-2xl font-bold">📊 Mijn vooruitgang</h1>

      <div className="mb-4 rounded-2xl bg-white p-3 shadow-sm">
        {/* 12×12 met producten tot 144 past niet op een smal scherm; laat het schuiven. */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[22rem] table-fixed border-separate border-spacing-0.5 text-center text-[11px] tabular-nums">
            <thead>
              <tr>
                <th className="text-slate-400">×</th>
                {TABLES.map((b) => (
                  <th key={b} className="font-semibold text-slate-500">
                    {b}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {TABLES.map((a) => (
                <tr key={a}>
                  <th className="font-semibold text-slate-500">{a}</th>
                  {TABLES.map((b) => {
                    const f = getFact(facts, a, b)
                    return (
                      <td key={b} className={`rounded py-1 ${KLEUR[f.box]}`}>
                        {a * b}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-3 flex items-center justify-center gap-1 text-xs text-slate-500">
          <span>nog niet gezien</span>
          {Array.from({ length: MAX_BOX + 1 }, (_, i) => (
            <span key={i} className={`inline-block size-4 rounded ${KLEUR[i]}`} />
          ))}
          <span>vanbuiten</span>
        </div>

        <p className="mt-3 text-center">
          <b className="text-lg">{gekend}</b> van de {alle.length} sommen ken je vanbuiten ⭐
        </p>
      </div>

      <button onClick={onBack} className="w-full py-3 text-slate-500">
        ← Terug
      </button>
      <button
        onClick={() => confirm('Alle vooruitgang wissen?') && onReset()}
        className="w-full py-3 text-rose-600"
      >
        Alles wissen
      </button>
    </div>
  )
}
