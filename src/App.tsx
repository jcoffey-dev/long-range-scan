import { useCallback, useEffect, useRef, useState, useReducer } from 'react'
import { DEEP_END, DEEP_PATROL, DEEP_TITLE } from './audio/deepspace'
import { END_TUNE, PATROL_TUNE, TITLE_TUNE } from './audio/tunes'
import { synth } from './audio/synth'
import { HAIL_TEXT } from './game/constants'
import { makePatrol, randomSeed, shortRangeScan, step } from './game/engine'
import { fetchScores, submitScores, type Score } from './game/highscores'
import { makeRng, type Rng } from './game/rng'
import { currentCaptain, initialState, reducer } from './game/reducer'
import type { Command, Line } from './game/types'
import { useSkin } from './skin'
import { Btn, Fit, Frame } from './components/Frame'
import { BridgeScreen } from './components/BridgeScreen'
import {
  BootScreen,
  GameOverScreen,
  HighScoreScreen,
  InstructionsScreen,
  ReportScreen,
  SetupScreen,
  TitleScreen,
  type BoardState,
} from './components/screens'
import './App.css'

/**
 * AGPL section 13: anyone playing this over a network is entitled to the
 * source of the version they are playing, so the offer sits on every screen.
 */
const SOURCE_URL = 'https://github.com/Coffey-Labs/long-range-scan'

/**
 * The way back out.
 *
 * Absolute rather than `/`, because this game is served from a subdirectory in
 * production and from the root in development -- so the relative answer is
 * right in one of those and points at the game itself in the other. The
 * destination is a particular site, and naming it is the honest way to say so.
 * The source link next to it works the same way for the same reason.
 */
const GAMES_URL = 'https://games.jcoffey.dev/'

export default function App() {
  const [seed] = useState(randomSeed)
  const [state, dispatch] = useReducer(reducer, seed, initialState)
  const rng = useRef<Rng>(makeRng(seed))
  const [music, setMusic] = useState(true)
  const [sfx, setSfx] = useState(true)
  const started = useRef(false)
  const { skin, toggle: toggleSkin } = useSkin()
  const [scores, setScores] = useState<Score[]>([])
  const [boardState, setBoardState] = useState<BoardState>('loading')
  const [freshScores, setFreshScores] = useState<string[]>([])
  /** True while the printer is mid-line, so no prompt appears over it. */
  const [printing, setPrinting] = useState(false)

  const who = currentCaptain(state)

  // ------------------------------------------------------------ audio glue

  const wake = useCallback(() => {
    if (started.current) return
    started.current = true
    synth.ensure()
    synth.setMusic(music)
    synth.setSfx(sfx)
  }, [music, sfx])

  /**
   * 1971 gets the chiptune it never had; the remaster gets the orchestra.
   *
   * It is the same theme in both, in the same key -- see `audio/tunes.ts`.
   * Switching skin mid-patrol re-scores the piece rather than changing the
   * record, which is the one thing that makes the toggle feel like a remaster
   * rather than a second game.
   */
  useEffect(() => {
    if (!started.current) return
    const front =
      state.phase === 'title' || state.phase === 'instructions' || state.phase === 'setup'
    const set =
      skin === 'modern'
        ? { title: DEEP_TITLE, patrol: DEEP_PATROL, end: DEEP_END }
        : { title: TITLE_TUNE, patrol: PATROL_TUNE, end: END_TUNE }
    const tune =
      state.phase === 'gameover' || state.phase === 'report'
        ? set.end
        : front
          ? set.title
          : set.patrol
    synth.playTune(tune, false)
  }, [state.phase, skin])

  useEffect(() => {
    synth.setMusic(music)
  }, [music])
  useEffect(() => {
    synth.setSfx(sfx)
  }, [sfx])

  const blip = useCallback(() => synth.blip(), [])

  const loadBoard = useCallback(async () => {
    setBoardState('loading')
    try {
      setScores(await fetchScores())
      setBoardState('ready')
    } catch {
      setBoardState('error')
    }
  }, [])

  // ---------------------------------------------------------------- turns

  /**
   * Deal a galaxy for whoever is up, and open the way the machine opened: the
   * orders, then a scan, because the first thing anybody did was look.
   *
   * The galaxy is dealt off the same seeded stream as everything else, which
   * is what makes a whole session -- four captains, four patrols -- replayable
   * from the one number in the footer.
   */
  const beginPatrol = useCallback(() => {
    const patrol = makePatrol(rng.current)
    const lines: Line[] = [
      ...HAIL_TEXT.map((text): Line => ({ kind: 'system', text })),
      {
        kind: 'system',
        text: `${patrol.raidersLeft} RAIDERS. ${patrol.basesLeft} STARBASE${patrol.basesLeft === 1 ? '' : 'S'}. ${patrol.deadline - patrol.day} DAYS.`,
      },
      ...shortRangeScan(patrol),
    ]
    dispatch({ type: 'BEGIN_PATROL', patrol, lines })
  }, [])

  // Whenever it is somebody's turn and there is no galaxy, deal them one.
  useEffect(() => {
    if (state.phase !== 'patrol' || state.patrol || !who) return
    beginPatrol()
  }, [state.phase, state.patrol, who, beginPatrol])

  const command = (cmd: Command, echo: Line[]) => {
    if (!state.patrol) return
    const { patrol, lines } = step(state.patrol, cmd, rng.current)

    /*
     * The sound belongs to what happened, so it is chosen from the lines the
     * engine produced rather than guessed at from the command. Firing the
     * beams and hitting something with them are two different noises, and
     * only the engine knows whether the second one happened.
     */
    const said = (t: string) => lines.some((l) => l.text.includes(t))

    if (cmd.type === 'nav') synth.warp()
    else if (cmd.type === 'beams') synth.beams()
    else if (cmd.type === 'torpedo') synth.torpedo()

    if (said('COMES APART') || said('DIRECT HIT') || said('IS GONE')) synth.explode()
    if (said('CONDITION RED')) synth.alert()
    if (said('UNIT HIT')) synth.hit()
    if (said('DAMAGED.')) synth.damaged()
    if (said('MOORED')) synth.dock()

    if (patrol.outcome === 'mission-complete') synth.fanfare()
    else if (patrol.outcome) synth.sad()

    dispatch({ type: 'ADVANCE', patrol, lines: [...echo, ...lines] })
  }

  // The report waits for the printer to finish saying how it ended.
  useEffect(() => {
    if (state.phase !== 'resolve' || printing) return
    const t = window.setTimeout(() => dispatch({ type: 'SHOW_REPORT' }), 500)
    return () => window.clearTimeout(t)
  }, [state.phase, printing])

  /**
   * Close the books. The standings show straight away; posting to the board
   * happens behind them, so a slow or missing line out never holds up the end
   * of a session.
   */
  const post = useCallback((captains: typeof state.captains) => {
    setBoardState('loading')
    submitScores(
      captains.map((c) => ({
        name: c.name,
        killed: c.killed,
        daysLeft: c.daysLeft,
        torpedoes: c.torpedoes,
        ending: c.outcome,
      })),
    )
      .then(({ ids, scores: table }) => {
        setScores(table)
        setFreshScores(ids)
        setBoardState('ready')
      })
      .catch(() => setBoardState('error'))
  }, [])

  const posted = useRef(false)
  useEffect(() => {
    if (state.phase !== 'gameover' || posted.current) return
    posted.current = true
    post(state.captains)
  }, [state.phase, state.captains, post])

  const restart = () => {
    synth.select()
    const s = randomSeed()
    rng.current = makeRng(s)
    posted.current = false
    setFreshScores([])
    dispatch({ type: 'RESTART', seed: s })
  }

  const showScores = () => {
    wake()
    synth.select()
    dispatch({ type: 'SHOW_SCORES' })
    if (boardState !== 'ready') void loadBoard()
  }

  // --------------------------------------------------------------- render

  const moreToCome = state.captains.some((c) => !c.done && c.id !== who?.id)

  return (
    <div className="app" onPointerDown={wake} onKeyDown={wake}>
      <Frame
        footer={
          <div className="controls">
            {/* Leftmost, because that is where a way back belongs. */}
            <a className="btn btn-ghost back" href={GAMES_URL} title="The rest of the games">
              GAMES
            </a>
            <Btn
              kind="ghost"
              onClick={() => {
                wake()
                setMusic((m) => !m)
              }}
              title="Background music"
            >
              MUSIC {music ? 'ON' : 'OFF'}
            </Btn>
            <Btn
              kind="ghost"
              onClick={() => {
                wake()
                setSfx((v) => !v)
              }}
              title="Sound effects"
            >
              SOUND {sfx ? 'ON' : 'OFF'}
            </Btn>
            <Btn
              kind="ghost"
              onClick={() => {
                wake()
                synth.select()
                toggleSkin()
              }}
              title={skin === 'teletype' ? 'Switch to the remaster' : 'Switch to the 1971 terminal'}
            >
              {skin === 'teletype' ? 'REMASTER' : '1971'}
            </Btn>
            <Btn kind="ghost" onClick={restart} title="Abandon this session">
              NEW PATROL
            </Btn>
            <a
              className="btn btn-ghost"
              href={SOURCE_URL}
              target="_blank"
              rel="noreferrer noopener"
              title="Free software, AGPL-3.0-or-later"
            >
              SOURCE
            </a>
            <span className="seed">SEED {state.seed}</span>
          </div>
        }
      >
        {state.phase === 'boot' && <BootScreen onLoaded={() => dispatch({ type: 'BOOTED' })} />}

        <Fit>
          {state.phase === 'title' && (
            <TitleGate
              onStart={() => {
                wake()
                synth.select()
                dispatch({ type: 'SHOW_SETUP' })
              }}
              onInstructions={() => {
                wake()
                synth.select()
                dispatch({ type: 'SHOW_INSTRUCTIONS' })
              }}
              onScores={showScores}
            />
          )}

          {state.phase === 'instructions' && (
            <InstructionsScreen onDone={() => dispatch({ type: 'SHOW_SETUP' })} />
          )}

          {state.phase === 'setup' && (
            <SetupScreen
              onStart={(names) => {
                wake()
                synth.select()
                dispatch({ type: 'START', names })
              }}
              onBlip={blip}
            />
          )}

          {(state.phase === 'patrol' || state.phase === 'resolve') && state.patrol && who && (
            <BridgeScreen
              key={who.id}
              patrol={state.patrol}
              transcript={state.transcript}
              captainName={who.name}
              over={state.phase === 'resolve'}
              onCommand={command}
              onPrint={(lines) => dispatch({ type: 'PRINT', lines })}
              onBlip={blip}
            />
          )}

          {state.phase === 'report' && state.patrol && who && (
            <ReportScreen
              patrol={state.patrol}
              captain={state.captains[who.id]!}
              moreToCome={moreToCome}
              onNext={() => {
                synth.select()
                dispatch({ type: 'NEXT_TURN' })
              }}
            />
          )}

          {state.phase === 'gameover' && (
            <GameOverScreen
              captains={state.captains}
              onRestart={restart}
              onScores={showScores}
            />
          )}

          {state.phase === 'scores' && (
            <HighScoreScreen
              scores={scores}
              state={boardState}
              highlight={freshScores}
              onBack={() => {
                synth.select()
                dispatch({ type: 'CLOSE_SCORES' })
              }}
              onRetry={() => {
                synth.select()
                void loadBoard()
              }}
            />
          )}
        </Fit>
      </Frame>
      {/* Kept out of the tree above so a re-render of the game cannot reset it. */}
      <PrintingWatcher lines={state.transcript} onChange={setPrinting} />
    </div>
  )
}

/**
 * Whether the machine is still typing.
 *
 * The prompt must not appear while a line is half printed -- the whole point
 * of the printing terminal is that you read what arrived before you answer
 * it.
 *
 * It times the characters that have just *arrived*, not the whole transcript.
 * Timing the whole thing is the obvious way to write this and it is wrong in
 * a way that takes a few turns to notice: `Teletype` only prints lines it has
 * not printed yet, so the wait keeps growing while the actual printing stays
 * the same length. A scan is not timed at all, because it lands whole.
 */
function PrintingWatcher({
  lines,
  onChange,
}: {
  lines: Line[]
  onChange: (busy: boolean) => void
}) {
  const chars = lines.reduce((n, l) => n + (l.kind === 'scan' ? 0 : l.text.length), 0)
  const printed = useRef(0)

  useEffect(() => {
    // A new patrol throws the transcript away; nothing is owed from the old one.
    if (chars < printed.current) printed.current = 0

    const fresh = chars - printed.current
    printed.current = chars
    if (fresh <= 0) {
      onChange(false)
      return
    }

    onChange(true)
    // 60 characters a second, plus a beat to read the last line.
    const t = window.setTimeout(() => onChange(false), (fresh / 60) * 1000 + 120)
    return () => window.clearTimeout(t)
  }, [chars, onChange])
  return null
}

/** Enter or Space takes the patrol, the way a terminal would take it. */
function TitleGate(props: {
  onStart: () => void
  onInstructions: () => void
  onScores: () => void
}) {
  const { onStart } = props
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') onStart()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onStart])
  return <TitleScreen {...props} />
}
