import * as React from "react"

import { countries, type Country } from "@/lib/countries"

export const OPTION_COUNT = 4

// Auto-advance timings. A wrong answer lingers longer so the correct flag can
// register before the next round loads.
const CORRECT_ADVANCE = 280
const WRONG_ADVANCE = 700

function shuffle<T>(items: T[]): T[] {
  const next = [...items]
  for (let i = next.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[next[i], next[j]] = [next[j], next[i]]
  }
  return next
}

export function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches
}

export type Round = {
  id: number
  answer: Country
  options: Country[]
}

// Draws answers from a shuffled deck so every country is shown once before any
// repeats. When the deck empties it reshuffles, avoiding an immediate repeat of
// the country that just wrapped the previous deck.
function createDeck() {
  let deck: Country[] = []
  let lastDrawn: Country | null = null

  return function draw(): Country {
    if (deck.length === 0) {
      const reshuffled = shuffle(countries)
      if (lastDrawn && reshuffled[0].code === lastDrawn.code) {
        ;[reshuffled[0], reshuffled[1]] = [reshuffled[1], reshuffled[0]]
      }
      deck = reshuffled
    }
    lastDrawn = deck.pop()!
    return lastDrawn
  }
}

function makeRoundFactory() {
  const draw = createDeck()
  let id = 0

  return function nextRound(): Round {
    const answer = draw()
    const distractors = shuffle(
      countries.filter((c) => c.code !== answer.code)
    ).slice(0, OPTION_COUNT - 1)
    return { id: id++, answer, options: shuffle([answer, ...distractors]) }
  }
}

export type Quiz = {
  round: Round
  picked: string | null
  answered: boolean
  isCorrect: boolean
  streak: number
  best: number
  total: number
  correct: number
  accuracy: number
  reduceMotion: boolean
  /** Register an answer. Extra picks after the first are ignored. */
  pick: (code: string) => void
  /** Skip to the next round immediately (also cancels the pending advance). */
  next: () => void
}

// All quiz state and scoring. Presentational variants consume this and add
// their own layout, type, and motion on top.
export function useQuiz(): Quiz {
  const [drawRound] = React.useState(makeRoundFactory)
  const [round, setRound] = React.useState<Round>(drawRound)
  const [picked, setPicked] = React.useState<string | null>(null)
  const [streak, setStreak] = React.useState(0)
  const [best, setBest] = React.useState(0)
  const [total, setTotal] = React.useState(0)
  const [correct, setCorrect] = React.useState(0)
  const [reduceMotion] = React.useState(prefersReducedMotion)

  const advanceTimer = React.useRef<number | undefined>(undefined)

  const answered = picked !== null
  const isCorrect = picked === round.answer.code

  const next = React.useCallback(() => {
    window.clearTimeout(advanceTimer.current)
    setRound(drawRound())
    setPicked(null)
  }, [drawRound])

  const pick = React.useCallback(
    (code: string) => {
      // Ignore extra picks once this round is answered. Guarding here (rather
      // than inside a setPicked updater) keeps the scoring side effects below
      // out of a state updater, which StrictMode runs twice — that double-ran
      // them and awarded double points per answer.
      if (picked !== null) return
      setPicked(code)
      setTotal((t) => t + 1)

      const gotIt = code === round.answer.code
      if (gotIt) {
        setCorrect((c) => c + 1)
        setStreak((s) => {
          const nextStreak = s + 1
          setBest((b) => Math.max(b, nextStreak))
          return nextStreak
        })
      } else {
        setStreak(0)
      }

      advanceTimer.current = window.setTimeout(
        next,
        gotIt ? CORRECT_ADVANCE : WRONG_ADVANCE
      )
    },
    [picked, round, next]
  )

  React.useEffect(() => () => window.clearTimeout(advanceTimer.current), [])

  const accuracy = total === 0 ? 0 : Math.round((correct / total) * 100)

  return {
    round,
    picked,
    answered,
    isCorrect,
    streak,
    best,
    total,
    correct,
    accuracy,
    reduceMotion,
    pick,
    next,
  }
}
