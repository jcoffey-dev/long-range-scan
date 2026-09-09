import { useEffect, useRef, useState } from 'react'
import { DIAL_UP, synth } from '../audio/synth'
import { MAX_CAPTAINS, MAX_NAME, START_ENERGY, START_TORPEDOES } from '../game/constants'
import { comparePatrols, outcomeText } from '../game/engine'
import type { Score } from '../game/highscores'
import type { Captain, Patrol } from '../game/types'
import { isWin } from '../game/types'
import { COMMANDS } from './BridgeScreen'
import { Btn, Line } from './Frame'

/**
 * Everything that is not the patrol itself. These are small enough that
 * keeping them in one file makes the shape of the game easier to see than
 * eight files would, and none of them holds a rule.
 */

// ------------------------------------------------------------------- boot

/**
 * Dialling in.
 *
 * The lemonade stand loads from cassette because that is how an Atari got its
 * programs. This game is eight years older than that machine and did not live
 * on a machine you owned at all -- it lived on a mainframe at the end of a
 * telephone line, which you called. So the boot is a real Bell 103 call, and
 * pushing the handset into the coupler is the gesture that unlocks the audio:
 * browsers want a gesture before they will make a sound, and that happens to
 * be exactly the gesture the game already wanted.
 *
 * The stages are printed as they happen, from the same schedule the audio is
 * built on, so what is on the paper is what is on the line. See DIAL_UP.
 */
const STAGES: [number, string][] = [
  [0, 'DIAL TONE'],
  [DIAL_UP.dialTone, 'DIALLING 555-1971'],
  [DIAL_UP.ringAt, 'RINGING'],
  [DIAL_UP.answerAt, 'ANSWER TONE 2225 HZ'],
  [DIAL_UP.answerAt + DIAL_UP.answer, 'CARRIER -- 110 BAUD, FULL DUPLEX'],
]

export function BootScreen({ onLoaded }: { onLoaded: () => void }) {
  const [dialling, setDialling] = useState(false)
  const [stage, setStage] = useState(-1)
  const stop = useRef<(() => void) | null>(null)

  useEffect(() => {
    if (!dialling) return
    stop.current = synth.dialUp()

    const timers = STAGES.map(([at], i) => window.setTimeout(() => setStage(i), at * 1000))
    const done = window.setTimeout(() => {
      stop.current?.()
      onLoaded()
    }, DIAL_UP.total * 1000)

    return () => {
      for (const t of timers) window.clearTimeout(t)
      window.clearTimeout(done)
      stop.current?.()
    }
  }, [dialling, onLoaded])

  if (!dialling) {
    return (
      <div className="stack boot">
        <Line className="accent">LONG RANGE SCAN</Line>
        <Line> </Line>
        <Line>THE PROGRAM IS NOT ON THIS MACHINE. IT IS ON SOMEBODY ELSE'S.</Line>
        <Line className="dim">PUT THE HANDSET IN THE COUPLER AND CALL IT.</Line>
        <Line> </Line>
        <Btn
          kind="primary"
          onClick={() => {
            synth.ensure()
            setDialling(true)
          }}
        >
          DIAL
        </Btn>
      </div>
    )
  }

  return (
    <div className="stack boot">
      {STAGES.slice(0, stage + 1).map(([, what], i) => (
        <Line key={i} className={i === stage ? '' : 'dim'}>
          {what}
        </Line>
      ))}
    </div>
  )
}

// ------------------------------------------------------------------ title

export function TitleScreen({
  onStart,
  onInstructions,
  onScores,
}: {
  onStart: () => void
  onInstructions: () => void
  onScores: () => void
}) {
  return (
    <div className="stack title">
      <h1 className="banner">LONG RANGE SCAN</h1>
      <Line className="dim">A PATROL, A CLOCK, AND SIXTY-FOUR QUADRANTS TO SEARCH.</Line>
      <Line> </Line>
      <Line>RAIDERS ARE SCATTERED THROUGH THE GALAXY. YOU HAVE ONE SHIP AND NOT LONG.</Line>
      <Line> </Line>
      <div className="prompt-row">
        <Btn kind="primary" onClick={onStart}>
          TAKE THE PATROL
        </Btn>
        <Btn onClick={onInstructions}>ORDERS</Btn>
        <Btn onClick={onScores}>BOARD</Btn>
      </div>
    </div>
  )
}

// ----------------------------------------------------------- instructions

export function InstructionsScreen({ onDone }: { onDone: () => void }) {
  return (
    <div className="stack orders">
      <Line className="accent">YOUR ORDERS</Line>
      <Line>FIND EVERY RAIDER IN THE GALAXY AND DESTROY IT BEFORE YOUR TIME RUNS OUT.</Line>
      <Line> </Line>
      <Line className="accent">THE GALAXY</Line>
      <Line>EIGHT BY EIGHT QUADRANTS. EACH QUADRANT IS EIGHT BY EIGHT SECTORS.</Line>
      <Line>A LONG RANGE SCAN READS THREE DIGITS PER QUADRANT: RAIDERS, STARBASES, STARS.</Line>
      <Line>SO 205 IS TWO RAIDERS, NO BASE AND FIVE STARS. READING THOSE IS THE GAME.</Line>
      <Line> </Line>
      <Line className="accent">THE SHIP</Line>
      <Line>
        {START_ENERGY} UNITS OF ENERGY AND {START_TORPEDOES} TORPEDOES. ENERGY MOVES YOU, FIRES
        THE BEAMS AND FILLS THE SHIELDS -- IT IS ALL THE SAME POOL.
      </Line>
      <Line>EIGHT DEVICES CAN BE BROKEN BY A HIT. DAMAGE CONTROL WORKS ONLY WHILE YOU FLY.</Line>
      <Line>MOOR NEXT TO A STARBASE AND YOU ARE FULL AGAIN. THERE ARE NOT MANY OF THEM.</Line>
      <Line> </Line>
      <Line className="accent">STEERING</Line>
      <Line>COURSES RUN 1 TO 9 ANTICLOCKWISE. 1 IS ALONG THE ROW, 3 IS UP, 5 IS BACK, 7 IS
        DOWN, AND 9 IS 1 AGAIN. WARP 1 IS EIGHT SECTORS.</Line>
      <Line> </Line>
      <Line className="accent">THE COMMANDS</Line>
      {COMMANDS.map(([id, what]) => (
        <Line key={id}>
          {id} {'  '} {what}
        </Line>
      ))}
      <Line> </Line>
      <Line className="dim">ON THE REMASTER YOU CAN POINT INSTEAD: CLICK A SECTOR TO WARP TO
        IT, A RAIDER TO PUT A TORPEDO THROUGH IT, A STARBASE TO MOOR ALONGSIDE, OR A QUADRANT
        ON THE CHART TO CROSS TO IT. IT TYPES THE SAME COMMANDS FOR YOU, AND SAYS SO.</Line>
      <Line> </Line>
      <Btn kind="primary" onClick={onDone}>
        UNDERSTOOD
      </Btn>
    </div>
  )
}

// ------------------------------------------------------------------ setup

export function SetupScreen({
  onStart,
  onBlip,
}: {
  onStart: (names: string[]) => void
  onBlip: () => void
}) {
  const [names, setNames] = useState<string[]>([''])

  const set = (i: number, v: string) =>
    setNames((n) => n.map((old, j) => (j === i ? v.slice(0, MAX_NAME) : old)))

  return (
    <div className="stack setup">
      <Line className="accent">WHO IS FLYING?</Line>
      <Line className="dim">EACH CAPTAIN GETS THEIR OWN GALAXY. YOU TAKE IT IN TURNS.</Line>
      <Line> </Line>
      {names.map((name, i) => (
        <div className="field" key={i}>
          <label htmlFor={`captain-${i}`}>CAPTAIN {i + 1}</label>
          <input
            id={`captain-${i}`}
            className="field-input"
            value={name}
            maxLength={MAX_NAME}
            placeholder={`CAPTAIN ${i + 1}`}
            onChange={(e) => set(i, e.target.value)}
          />
        </div>
      ))}
      <Line> </Line>
      <div className="prompt-row">
        {names.length < MAX_CAPTAINS && (
          <Btn
            onClick={() => {
              onBlip()
              setNames((n) => [...n, ''])
            }}
          >
            ONE MORE
          </Btn>
        )}
        <Btn kind="primary" onClick={() => onStart(names)}>
          CAST OFF
        </Btn>
      </div>
    </div>
  )
}

// ----------------------------------------------------------------- report

/** The end of one captain's patrol, before the next one sits down. */
export function ReportScreen({
  patrol,
  captain,
  moreToCome,
  onNext,
}: {
  patrol: Patrol
  captain: Captain
  moreToCome: boolean
  onNext: () => void
}) {
  const won = isWin(patrol.outcome)
  return (
    <div className="stack report">
      <Line className={won ? 'accent' : 'warn'}>
        {patrol.outcome ? outcomeText(patrol.outcome) : ''}
      </Line>
      <Line> </Line>
      <Line>
        {captain.name} — {captain.killed} DESTROYED, {captain.daysLeft.toFixed(1)} DAYS LEFT,{' '}
        {captain.torpedoes} TORPEDO{captain.torpedoes === 1 ? '' : 'ES'}
      </Line>
      <Line className="dim">
        {patrol.raidersLeft} RAIDER{patrol.raidersLeft === 1 ? '' : 'S'} STILL OUT THERE.
      </Line>
      <Line> </Line>
      <Btn kind="primary" onClick={onNext}>
        {moreToCome ? 'NEXT CAPTAIN' : 'THAT IS THAT'}
      </Btn>
    </div>
  )
}

// --------------------------------------------------------------- standings

export function GameOverScreen({
  captains,
  onRestart,
  onScores,
}: {
  captains: Captain[]
  onRestart: () => void
  onScores: () => void
}) {
  const ranked = [...captains].sort(comparePatrols)
  const anyWon = captains.some((c) => isWin(c.outcome))
  return (
    <div className="stack over">
      <Line className="accent">
        {anyWon ? 'THE FLEET IS SATISFIED.' : 'THE RAIDERS ARE STILL OUT THERE.'}
      </Line>
      <Line> </Line>
      {ranked.map((c, i) => (
        <Line key={c.id}>
          {String(i + 1).padStart(2)}. {c.name.padEnd(MAX_NAME)}{' '}
          {String(c.killed).padStart(2)} KILLED {c.daysLeft.toFixed(1).padStart(5)} DAYS{' '}
          {String(c.torpedoes).padStart(2)} TORP
        </Line>
      ))}
      <Line> </Line>
      <div className="prompt-row">
        <Btn kind="primary" onClick={onRestart}>
          AGAIN
        </Btn>
        <Btn onClick={onScores}>BOARD</Btn>
      </div>
    </div>
  )
}

// ------------------------------------------------------------------- board

export type BoardState = 'loading' | 'ready' | 'error'

export function HighScoreScreen({
  scores,
  state,
  highlight,
  onBack,
  onRetry,
}: {
  scores: Score[]
  state: BoardState
  highlight: string[]
  onBack: () => void
  onRetry: () => void
}) {
  return (
    <div className="stack board">
      <Line className="accent">THE BOARD</Line>
      <Line className="dim">RANKED ON RAIDERS DESTROYED, THEN DAYS LEFT, THEN TORPEDOES.</Line>
      <Line> </Line>
      {state === 'loading' && <Line>ASKING THE MACHINE...</Line>}
      {state === 'error' && (
        <>
          {/* The game is entirely playable without the board, and says so
              rather than pretending the patrol did not happen. */}
          <Line className="warn">THE BOARD IS NOT ANSWERING. YOUR PATROL STILL COUNTED.</Line>
          <Line> </Line>
          <Btn onClick={onRetry}>TRY AGAIN</Btn>
        </>
      )}
      {state === 'ready' && scores.length === 0 && <Line>NOBODY HAS REPORTED IN YET.</Line>}
      {state === 'ready' &&
        scores.map((s, i) => (
          <Line key={s.id} className={highlight.includes(s.id) ? 'accent' : ''}>
            {String(i + 1).padStart(2)}. {s.name.padEnd(MAX_NAME)}{' '}
            {String(s.killed).padStart(2)} {s.daysLeft.toFixed(1).padStart(5)}{' '}
            {String(s.torpedoes).padStart(2)}
          </Line>
        ))}
      <Line> </Line>
      <Btn kind="primary" onClick={onBack}>
        BACK
      </Btn>
    </div>
  )
}
