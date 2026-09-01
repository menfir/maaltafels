import { useState } from 'react'
import Home, { type Mode } from './screens/Home'
import Progress from './screens/Progress'
import Quiz from './screens/Quiz'
import { type Progress as Opgeslagen, fresh, load, save } from './store'
import {
  type Fact,
  type Grade,
  applyAnswer,
  buildExtraSession,
  buildLearnSession,
  buildSession,
  buildTimedSession,
  buildWeakSession,
} from './tables'

type Scherm =
  | { naam: 'home' }
  | { naam: 'quiz'; mode: Mode; queue: Fact[]; extra: boolean }
  | { naam: 'progress' }

export default function App() {
  const [data, setData] = useState<Opgeslagen>(load)
  const [scherm, setScherm] = useState<Scherm>({ naam: 'home' })

  function bewaar(next: Opgeslagen) {
    setData(next)
    save(next)
  }

  function start(mode: Mode, table?: number) {
    const { facts, tables } = data
    if (mode === 'leren' && table !== undefined) {
      setScherm({ naam: 'quiz', mode, queue: buildLearnSession(facts, table), extra: false })
      return
    }
    if (mode === 'tijd') {
      setScherm({ naam: 'quiz', mode, queue: buildTimedSession(facts, tables), extra: true })
      return
    }
    if (mode === 'moeilijk') {
      const zwak = buildWeakSession(facts, tables)
      // Niets zwaks gevonden? Dan is er niets om te repareren; val terug op gewoon oefenen.
      setScherm(
        zwak.length > 0
          ? { naam: 'quiz', mode, queue: zwak, extra: true }
          : { naam: 'quiz', mode: 'oefenen', queue: buildSession(facts, tables, Date.now()), extra: false },
      )
      return
    }
    // Oefenen: staat er niets op het schema, dan toch laten oefenen — maar buiten het schema.
    const gepland = buildSession(facts, tables, Date.now())
    setScherm(
      gepland.length > 0
        ? { naam: 'quiz', mode, queue: gepland, extra: false }
        : { naam: 'quiz', mode, queue: buildExtraSession(facts, tables), extra: true },
    )
  }

  if (scherm.naam === 'quiz') {
    return (
      <Quiz
        queue={scherm.queue}
        mode={scherm.mode}
        extra={scherm.extra}
        // Bewaren per antwoord: sluit ze de tablet halverwege, dan is de voortgang er nog.
        // Toepassen op de actuele staat, niet op de momentopname in de wachtrij.
        onAnswer={(fact: Fact, g: Grade, extra: boolean) =>
          setData((prev) => {
            const next = {
              ...prev,
              facts: applyAnswer(prev.facts, fact.a, fact.b, g, Date.now(), extra),
            }
            save(next)
            return next
          })
        }
        onExit={() => setScherm({ naam: 'home' })}
      />
    )
  }

  if (scherm.naam === 'progress') {
    return (
      <Progress
        facts={data.facts}
        onBack={() => setScherm({ naam: 'home' })}
        onReset={() => {
          bewaar(fresh())
          setScherm({ naam: 'home' })
        }}
      />
    )
  }

  return (
    <Home
      facts={data.facts}
      tables={data.tables}
      onToggleTable={(n) => {
        const tables = data.tables.includes(n)
          ? data.tables.filter((x) => x !== n)
          : [...data.tables, n].sort((x, y) => x - y)
        // Nooit alles uitzetten: dan valt er niets te oefenen en is elk scherm leeg.
        bewaar({ ...data, tables: tables.length ? tables : [n] })
      }}
      onStart={start}
      onProgress={() => setScherm({ naam: 'progress' })}
    />
  )
}
