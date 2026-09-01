import { useEffect, useRef, useState } from 'react'
import { canListen, canSpeak, listen, speak } from '../speech'
import {
  type Fact,
  type Grade,
  TIMED_MS,
  gradeAnswer,
  parseNumber,
  product,
} from '../tables'
import type { Mode } from './Home'

const FEEDBACK: Record<Grade, { titel: string; klasse: string }> = {
  vlot: { titel: 'Juist!', klasse: 'bg-emerald-100 text-emerald-900' },
  traag: { titel: 'Juist — en straks nog wat vlotter', klasse: 'bg-emerald-100 text-emerald-900' },
  fout: { titel: 'Niet juist', klasse: 'bg-rose-100 text-rose-900' },
}

type Props = {
  queue: Fact[]
  mode: Mode
  /** Buiten het schema oefenen: alleen fouten tellen mee voor de planning. */
  extra: boolean
  onAnswer: (fact: Fact, g: Grade, extra: boolean) => void
  onExit: () => void
}

export default function Quiz({ queue: startQueue, mode, extra, onAnswer, onExit }: Props) {
  const [queue, setQueue] = useState<Fact[]>(startQueue)
  const [totaalStart] = useState(startQueue.length)
  const [getypt, setGetypt] = useState('')
  const [result, setResult] = useState<{ g: Grade; gegeven: number | null } | null>(null)
  const [luistert, setLuistert] = useState(false)
  const [micFout, setMicFout] = useState('')
  const [gedaan, setGedaan] = useState({ goed: 0, totaal: 0 })
  // Meteen in de juiste stand, anders flitst de vraag even voor de uitleg verschijnt.
  const [uitleg, setUitleg] = useState(() => mode === 'leren' && startQueue[0]?.box === 0)
  const [seconden, setSeconden] = useState(TIMED_MS / 1000)
  const gestart = useRef(0)
  const stopListening = useRef<() => void>(() => {})
  // Verwijst altijd naar de nieuwste toets(): de keydown-listener hangt er maar één keer aan.
  const toetsRef = useRef<(k: string) => void>(() => {})

  const item: Fact | undefined = queue[0]
  const opTijd = mode === 'tijd'
  const eerste = useRef(true)

  // Nieuwe som in de leermodus: eerst uitleggen, dan pas vragen.
  useEffect(() => {
    if (eerste.current) eerste.current = false
    else setUitleg(mode === 'leren' && !!item && item.box === 0)
    gestart.current = Date.now()
    return () => stopListening.current()
  }, [item, mode])

  // toets() is een hoisted functiedeclaratie, dus hier al gebonden. Bijwerken na elke
  // render, zodat de listener hieronder nooit een verouderde versie aanroept.
  useEffect(() => {
    toetsRef.current = toets
  })

  // Een echt toetsenbord mag ook werken; het numpad blijft de hoofdweg.
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (/^[0-9]$/.test(e.key)) toetsRef.current(e.key)
      else if (e.key === 'Backspace') toetsRef.current('wis')
      else if (e.key === 'Enter') toetsRef.current('ok')
    }
    addEventListener('keydown', h)
    return () => removeEventListener('keydown', h)
  }, [])

  // Klok voor de tijdmodus. Loopt door tijdens het antwoorden; dat is de bedoeling.
  useEffect(() => {
    if (!opTijd) return
    const einde = Date.now() + TIMED_MS
    const id = setInterval(() => {
      const over = Math.max(0, Math.ceil((einde - Date.now()) / 1000))
      setSeconden(over)
      if (over === 0) setQueue([])
    }, 250)
    return () => clearInterval(id)
  }, [opTijd])

  if (!item) {
    return (
      <div className="mx-auto max-w-md p-6 text-center">
        <h1 className="mt-8 mb-2 text-3xl font-bold">Klaar! 🎉</h1>
        <p className="mb-8 text-lg text-slate-600">
          {gedaan.totaal === 0
            ? 'Niets te oefenen op dit moment. Kies andere tafels of kom later terug.'
            : `${gedaan.goed} van ${gedaan.totaal} juist.`}
        </p>
        <button
          onClick={onExit}
          className="w-full rounded-xl bg-indigo-600 py-4 text-lg font-semibold text-white"
        >
          Terug
        </button>
      </div>
    )
  }

  const juist = product(item)

  function beoordeel(gegeven: number | null) {
    if (!item || result) return
    const g = gradeAnswer(gegeven, juist, Date.now() - gestart.current)
    setResult({ g, gegeven })
    setGedaan((s) => ({ goed: s.goed + (g === 'fout' ? 0 : 1), totaal: s.totaal + 1 }))
    onAnswer(item, g, extra)
  }

  function volgende() {
    // Fout? Achteraan in de rij, zodat de som deze sessie nog eens terugkomt.
    setQueue((q) => (result?.g === 'fout' ? [...q.slice(1), q[0]] : q.slice(1)))
    setResult(null)
    setGetypt('')
    setMicFout('')
  }

  function toets(k: string) {
    if (result) return
    if (k === 'wis') setGetypt((s) => s.slice(0, -1))
    else if (k === 'ok') {
      if (getypt) beoordeel(Number(getypt))
    } else if (getypt.length < 3) setGetypt((s) => s + k)
  }

  function spreek() {
    if (luistert) {
      stopListening.current()
      setLuistert(false)
      return
    }
    setMicFout('')
    setLuistert(true)
    stopListening.current = listen(
      'nl-BE',
      (alternatieven) => {
        setLuistert(false)
        // Elk alternatief dat het juiste getal oplevert telt — één treffer volstaat.
        // Zo verliest ze geen punt aan een herkenningsfoutje.
        const getallen = alternatieven.map(parseNumber)
        const beste = getallen.find((n) => n === juist) ?? getallen.find((n) => n !== null) ?? null
        if (beste === null) {
          setMicFout('Ik verstond geen getal — zeg enkel het antwoord.')
          return
        }
        setGetypt(String(beste))
        beoordeel(beste)
      },
      (msg) => {
        setLuistert(false)
        setMicFout(msg)
      },
    )
  }

  const voortgang = totaalStart ? Math.round(((totaalStart - queue.length) / totaalStart) * 100) : 0

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col p-4">
      <div className="mb-4 flex items-center gap-3">
        <button onClick={onExit} className="text-slate-500" aria-label="Stoppen">
          ✕
        </button>
        <div className="h-2 flex-1 rounded-full bg-slate-200">
          <div
            className="h-2 rounded-full bg-indigo-600 transition-all"
            style={{ width: `${opTijd ? 100 - (seconden / (TIMED_MS / 1000)) * 100 : voortgang}%` }}
          />
        </div>
        <span className="text-sm tabular-nums text-slate-500">
          {opTijd ? `${seconden}s · ${gedaan.goed}` : queue.length}
        </span>
      </div>

      {extra && !opTijd && (
        <p className="mb-4 rounded-lg bg-amber-50 p-2 text-center text-sm text-amber-800">
          Extra oefening — alles zit op schema. Fouten tellen mee, goede antwoorden niet.
        </p>
      )}

      {uitleg ? (
        <Uitleg fact={item} onDoor={() => { setUitleg(false); gestart.current = Date.now() }} />
      ) : (
        <>
          <div className="mb-6 flex items-center justify-center gap-3">
            <h1 className="text-5xl font-bold tabular-nums">
              {item.a} × {item.b}
            </h1>
            {canSpeak && (
              <button
                onClick={() => speak(`${item.a} keer ${item.b}`)}
                className="text-2xl text-slate-400"
                aria-label="Vraag voorlezen"
              >
                🔊
              </button>
            )}
          </div>

          {result ? (
            <div className={`mb-4 rounded-xl p-4 text-center ${FEEDBACK[result.g].klasse}`}>
              <p className="text-lg font-semibold">{FEEDBACK[result.g].titel}</p>
              <p className="text-3xl font-bold tabular-nums">
                {item.a} × {item.b} = {juist}
              </p>
              {result.g === 'fout' && result.gegeven !== null && (
                <p className="mt-1 text-sm opacity-75">jij zei: {result.gegeven}</p>
              )}
            </div>
          ) : (
            <>
              <div className="mb-3 flex gap-3">
                {/* Een div, geen input: dan roept de tablet geen toetsenbord op. */}
                <div className="flex h-20 flex-1 items-center justify-center rounded-xl border-4 border-slate-200 bg-white text-4xl font-bold tabular-nums">
                  {getypt}
                </div>
                {canListen && (
                  <button
                    onClick={spreek}
                    aria-label="Antwoord inspreken"
                    className={`w-20 rounded-xl text-3xl ${
                      luistert ? 'bg-rose-600 text-white' : 'bg-slate-200'
                    }`}
                  >
                    🎤
                  </button>
                )}
              </div>
              {micFout && <p className="mb-2 text-center text-sm text-rose-600">{micFout}</p>}
              <div className="grid grid-cols-3 gap-2">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'wis', '0', 'ok'].map((k) => (
                  <button
                    key={k}
                    onClick={() => toets(k)}
                    disabled={k === 'ok' && !getypt}
                    className={`rounded-xl py-4 text-2xl font-semibold shadow-sm disabled:opacity-40 ${
                      k === 'ok' ? 'bg-emerald-600 text-white' : 'bg-white text-slate-800'
                    }`}
                  >
                    {k === 'wis' ? '⌫' : k === 'ok' ? '✓' : k}
                  </button>
                ))}
              </div>
            </>
          )}
        </>
      )}

      <div className="mt-auto pt-4">
        {result && (
          <button
            onClick={volgende}
            autoFocus
            className="w-full rounded-xl bg-indigo-600 py-4 text-lg font-semibold text-white"
          >
            Volgende
          </button>
        )}
        {!result && !uitleg && (
          <button onClick={() => beoordeel(null)} className="w-full py-3 text-slate-500">
            Weet ik niet
          </button>
        )}
      </div>
    </div>
  )
}

/** Uitlegkaart bij een som die ze nog nooit zag: een rooster van stippen zegt meer dan het getal. */
function Uitleg({ fact, onDoor }: { fact: Fact; onDoor: () => void }) {
  return (
    <div className="rounded-2xl bg-indigo-50 p-4 text-center">
      <p className="text-xl font-semibold">
        {fact.a} keer {fact.b}
      </p>
      <div className="my-4 flex flex-col items-center gap-1.5">
        {Array.from({ length: fact.a }, (_, r) => (
          <div key={r} className="flex gap-1.5">
            {Array.from({ length: fact.b }, (_, c) => (
              <span key={c} className="size-2.5 rounded-full bg-indigo-600" />
            ))}
          </div>
        ))}
      </div>
      <p className="mb-4 text-slate-700">
        {Array(fact.a).fill(fact.b).join(' + ')} = <b>{product(fact)}</b>
      </p>
      <button
        onClick={onDoor}
        className="w-full rounded-xl bg-indigo-600 py-3 font-semibold text-white"
      >
        Begrepen
      </button>
    </div>
  )
}
