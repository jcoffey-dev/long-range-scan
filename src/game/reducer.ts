import { daysLeft } from './engine'
import type { Captain, Line, Patrol, Phase } from './types'

/**
 * The phase machine, and the only place a turn changes hands.
 *
 * A turn is one whole patrol, not one command. A captain flies until the
 * raiders are gone or something ends them, and only then does the printer go
 * quiet and the next captain sit down. Splitting turns command by command
 * would be fairer in some abstract sense and unplayable in practice: this is
 * a game about a galaxy you are holding in your head, and four people cannot
 * hold four of them at once. It is the same rule the cave game plays by, for
 * the same reason.
 *
 * Each captain gets their own galaxy, dealt off the same seeded stream. They
 * are not competing over one map -- they are being set the same kind of
 * problem and judged on what they did with it.
 */
export interface GameState {
  phase: Phase
  seed: number
  captains: Captain[]
  /** Index into `captains`; the finished are skipped, never removed. */
  turn: number
  patrol: Patrol | null
  /** Everything the machine has printed for the patrol now being flown. */
  transcript: Line[]
  /** Where the board was opened from, so BACK has somewhere to go. */
  scoresReturn: Phase
}

export const initialState = (seed: number, phase: Phase = 'boot'): GameState => ({
  phase,
  seed,
  captains: [],
  turn: 0,
  patrol: null,
  transcript: [],
  scoresReturn: 'title',
})

export type Action =
  | { type: 'BOOTED' }
  | { type: 'SHOW_INSTRUCTIONS' }
  | { type: 'SHOW_SETUP' }
  | { type: 'START'; names: string[] }
  | { type: 'BEGIN_PATROL'; patrol: Patrol; lines: Line[] }
  | { type: 'PRINT'; lines: Line[] }
  | { type: 'ADVANCE'; patrol: Patrol; lines: Line[] }
  | { type: 'SHOW_REPORT' }
  | { type: 'NEXT_TURN' }
  | { type: 'SHOW_SCORES' }
  | { type: 'CLOSE_SCORES' }
  | { type: 'RESTART'; seed: number }

/** Whose turn it is, or undefined once everybody has flown. */
export const currentCaptain = (s: GameState): Captain | undefined => s.captains[s.turn]

/** The next captain who has not flown yet, or -1 when they all have. */
export function nextWaiting(captains: Captain[], from: number): number {
  for (let i = 1; i <= captains.length; i++) {
    const at = (from + i) % captains.length
    if (!captains[at]!.done) return at
  }
  return -1
}

export function reducer(state: GameState, action: Action): GameState {
  switch (action.type) {
    case 'BOOTED':
      return { ...state, phase: 'title' }

    case 'SHOW_INSTRUCTIONS':
      return { ...state, phase: 'instructions' }

    case 'SHOW_SETUP':
      return { ...state, phase: 'setup' }

    case 'START':
      return {
        ...state,
        phase: 'patrol',
        captains: action.names.map((name, i) => ({
          id: i,
          name: name.trim().toUpperCase() || `CAPTAIN ${i + 1}`,
          killed: 0,
          daysLeft: 0,
          torpedoes: 0,
          done: false,
          outcome: null,
        })),
        turn: 0,
        patrol: null,
        transcript: [],
      }

    case 'BEGIN_PATROL':
      return { ...state, phase: 'patrol', patrol: action.patrol, transcript: action.lines }

    case 'PRINT':
      return { ...state, transcript: [...state.transcript, ...action.lines] }

    case 'ADVANCE':
      return {
        ...state,
        patrol: action.patrol,
        transcript: [...state.transcript, ...action.lines],
        phase: action.patrol.outcome ? 'resolve' : 'patrol',
      }

    /** The patrol has ended; settle it against the captain and show the report. */
    case 'SHOW_REPORT': {
      const patrol = state.patrol
      const who = currentCaptain(state)
      if (!patrol?.outcome || !who) return { ...state, phase: 'report' }

      const captains = state.captains.map((c) =>
        c.id !== who.id
          ? c
          : {
              ...c,
              killed: patrol.raidersKilled,
              daysLeft: Math.round(daysLeft(patrol) * 10) / 10,
              torpedoes: patrol.torpedoes,
              done: true,
              outcome: patrol.outcome,
            },
      )
      return { ...state, phase: 'report', captains }
    }

    case 'NEXT_TURN': {
      const at = nextWaiting(state.captains, state.turn)
      if (at === -1) return { ...state, phase: 'gameover', patrol: null }
      return { ...state, phase: 'patrol', turn: at, patrol: null, transcript: [] }
    }

    case 'SHOW_SCORES':
      return state.phase === 'scores'
        ? state
        : { ...state, phase: 'scores', scoresReturn: state.phase }

    case 'CLOSE_SCORES':
      return { ...state, phase: state.scoresReturn }

    case 'RESTART':
      // The tape only loads once a session; a new patrol starts at the title.
      return initialState(action.seed, 'title')

    default:
      return state
  }
}
