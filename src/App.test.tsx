// Rooktest: rendert de schermen zonder browser. Vangt een wit scherm door een crash
// bij het opstarten — de enige fout die alle andere tests zouden missen.
import { renderToString } from 'react-dom/server'
import { beforeEach, describe, expect, it } from 'vitest'
import App from './App'
import Progress from './screens/Progress'
import Quiz from './screens/Quiz'
import { newFact } from './tables'

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

describe('rendering', () => {
  it('start op zonder opgeslagen voortgang', () => {
    const html = renderToString(<App />)
    expect(html).toContain('Welke tafels oefen je?')
    expect(html).toContain('Nieuwe tafel leren')
  })

  it('toont de vraag en het numpad', () => {
    const html = renderToString(
      <Quiz
        queue={[{ a: 4, b: 7, box: 3, due: 0 }]}
        mode="oefenen"
        extra={false}
        onAnswer={() => {}}
        onExit={() => {}}
      />,
    )
    // React zet <!-- --> tussen tekstnodes, dus de delen los controleren.
    expect(html).toContain('4')
    expect(html).toContain('×')
    expect(html).toContain('⌫')
  })

  it('legt een nieuwe som eerst uit in de leermodus', () => {
    const html = renderToString(
      <Quiz queue={[newFact(3, 4)]} mode="leren" extra={false} onAnswer={() => {}} onExit={() => {}} />,
    )
    expect(html).toContain('Begrepen')
    expect(html).toContain('4 + 4 + 4')
  })

  it('meldt een lege sessie in plaats van te crashen', () => {
    const html = renderToString(
      <Quiz queue={[]} mode="oefenen" extra={false} onAnswer={() => {}} onExit={() => {}} />,
    )
    expect(html).toContain('Niets te oefenen op dit moment')
  })

  it('rendert het voortgangsrooster', () => {
    const html = renderToString(
      <Progress facts={{ '3x7': { a: 3, b: 7, box: 6, due: 0 } }} onBack={() => {}} onReset={() => {}} />,
    )
    expect(html).toContain('144') // de laatste cel van het 12×12-rooster
    expect(html).toContain('sommen ken je vanbuiten')
  })
})
