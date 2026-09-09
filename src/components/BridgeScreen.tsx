import { useEffect, useRef, useState } from 'react'
import { navFor } from '../game/aim'
import { SECTORS } from '../game/constants'
import { condition, daysLeft } from '../game/engine'
import { adjacent, occupant, same } from '../game/galaxy'
import type { Command, Coord, Line, Patrol } from '../game/types'
import { useSkin } from '../skin'
import { LogPanel } from './LogPanel'
import { ShipPanel } from './ShipPanel'
import { TacticalView, type SectorClick } from './TacticalView'
import { Teletype } from './Teletype'

/**
 * The console: the paper, and the one line you are allowed to type on.
 *
 * The original asks for a command and then asks for whatever that command
 * needs, one question at a time -- COMMAND, then COURSE, then WARP FACTOR --
 * because a printing terminal has no form to fill in and no way back to a
 * field you have already left. That is kept exactly, and it is why this
 * component is a tiny state machine rather than a set of inputs.
 *
 * Both skins get that same one-line console, and it is the same console:
 * whatever the screen around it looks like, the game is played by answering
 * one question at a time.
 *
 * What changes is everything else. The paper is a single column because a
 * roll of paper is a single column. The remaster is a bridge, which means
 * three: the ship down the left, the sensors in the middle, the log down the
 * right. The first draft put the sensors in the middle of a paper-shaped
 * column with the transcript squeezed underneath, and it was unreadable for
 * exactly the reason you would expect -- a four-by-three screen is wide, and
 * a column throws the width away.
 *
 * The remaster also points. Click a sector and you warp to it; click a raider
 * and you put a torpedo through it; click a starbase and you moor alongside;
 * click a quadrant on the chart and you cross the galaxy to it. None of that
 * is a new move. Every click is turned into the same course and warp factor
 * the prompt would have taken, and the echo below writes the questions and
 * the answers into the log as though they had been typed -- which is also
 * how anybody works out that course 3 is north. The keyboard still works and
 * is still the way it was meant to be played.
 */
type Ask = 'command' | 'nav-course' | 'nav-warp' | 'tor-course' | 'beams' | 'shields'

const QUESTION: Record<Ask, string> = {
  command: 'COMMAND',
  'nav-course': 'COURSE (1-9)',
  'nav-warp': 'WARP FACTOR (0-8)',
  'tor-course': 'TORPEDO COURSE (1-9)',
  beams: 'UNITS TO FIRE',
  shields: 'UNITS TO SHIELDS',
}

/** The nine, in the order the machine lists them when asked. */
export const COMMANDS: readonly (readonly [string, string])[] = [
  ['NAV', 'WARP SOMEWHERE ELSE'],
  ['SRS', 'SHORT RANGE SCAN'],
  ['LRS', 'LONG RANGE SCAN'],
  ['BEA', 'FIRE THE BEAMS'],
  ['TOR', 'FIRE A TORPEDO'],
  ['SHE', 'PUT ENERGY IN THE SHIELDS'],
  ['DAM', 'DAMAGE REPORT'],
  ['COM', 'THE CHART, AND WHERE YOU ARE ON IT'],
  ['XXX', 'BREAK OFF AND GO HOME'],
]

export function BridgeScreen({
  patrol,
  transcript,
  captainName,
  over,
  onCommand,
  onPrint,
  onBlip,
}: {
  patrol: Patrol
  transcript: Line[]
  captainName: string
  /** The patrol has ended. There is nothing left to ask. */
  over: boolean
  onCommand: (cmd: Command, echo: Line[]) => void
  onPrint: (lines: Line[]) => void
  onBlip: () => void
}) {
  const { skin } = useSkin()
  const [panel, setPanel] = useState<'sector' | 'galaxy'>('sector')
  const [ask, setAsk] = useState<Ask>('command')
  const [course, setCourse] = useState(0)
  const [text, setText] = useState('')
  const input = useRef<HTMLInputElement>(null)

  // The question moves on; the cursor should be waiting under it.
  useEffect(() => {
    input.current?.focus()
  }, [ask])

  const echo = (answer: string): Line => ({
    kind: 'system',
    text: `${QUESTION[ask]} ? ${answer}`,
  })

  /** The same line a typed answer leaves, for an answer that was clicked. */
  const asked = (question: string, answer: string): Line => ({
    kind: 'system',
    text: `${question} ? ${answer}`,
  })

  /** A move, expressed the only way the engine accepts one. */
  const navBy = (d: Coord) => {
    const { course, warp } = navFor(d)
    setAsk('command')
    onCommand({ type: 'nav', course, warp }, [
      asked(QUESTION.command, 'NAV'),
      asked(QUESTION['nav-course'], String(course)),
      asked(QUESTION['nav-warp'], String(warp)),
    ])
  }

  const clickSector = ({ at, what }: SectorClick) => {
    if (what === 'ship' || what === 'star') return onBlip()

    const to = (target: Coord): Coord => ({
      row: target.row - patrol.sector.row,
      col: target.col - patrol.sector.col,
    })

    if (what === 'raider') {
      const course = navFor(to(at)).course
      setPanel('sector')
      setAsk('command')
      onCommand({ type: 'torpedo', course }, [
        asked(QUESTION.command, 'TOR'),
        asked(QUESTION['tor-course'], String(course)),
      ])
      return
    }

    if (what === 'base') {
      // Mooring is standing next to it, so clicking it means "park here":
      // the nearest free sector alongside, which is what a player typing
      // this out would have had to work out for themselves.
      if (adjacent(patrol.sector, at)) return onBlip()
      const berth = mooringFor(patrol, at)
      if (!berth) return onBlip()
      navBy(to(berth))
      return
    }

    navBy(to(at))
  }

  const clickQuadrant = (at: Coord) => {
    setPanel('sector')
    navBy({
      row: (at.row - patrol.quadrant.row) * SECTORS,
      col: (at.col - patrol.quadrant.col) * SECTORS,
    })
  }

  /** Fire or set, from a button rather than two prompts. */
  const spend = (kind: 'beams' | 'shields', amount: number) => {
    setAsk('command')
    onCommand({ type: kind, energy: amount }, [
      asked(QUESTION.command, kind === 'beams' ? 'BEA' : 'SHE'),
      asked(QUESTION[kind], String(amount)),
    ])
  }

  const simpleClick = (id: string, cmd: Command) => {
    if (id === 'LRS' || id === 'COM') setPanel('galaxy')
    setAsk('command')
    onCommand(cmd, [asked(QUESTION.command, id)])
  }

  /** `raw` is how the command buttons answer: a click is a whole answer. */
  const submit = (raw?: string) => {
    const answer = (raw ?? text).trim().toUpperCase()
    if (answer === '') return
    setText('')

    if (ask === 'command') {
      const cmd = answer.slice(0, 3)
      const known = COMMANDS.some(([id]) => id === cmd)
      if (!known) {
        onPrint([echo(answer), { kind: 'system', text: 'THAT IS NOT ONE OF THE NINE.' }])
        return
      }

      // Two of them need more asking before anything happens.
      if (cmd === 'NAV') {
        onPrint([echo(answer)])
        setAsk('nav-course')
        return
      }
      if (cmd === 'TOR') {
        onPrint([echo(answer)])
        setAsk('tor-course')
        return
      }
      if (cmd === 'BEA') {
        onPrint([echo(answer)])
        setAsk('beams')
        return
      }
      if (cmd === 'SHE') {
        onPrint([echo(answer)])
        setAsk('shields')
        return
      }

      // Asking for a scan should show you that scan. The panel follows the
      // command rather than making the player find the right tab afterwards.
      if (cmd === 'LRS' || cmd === 'COM') setPanel('galaxy')
      if (cmd === 'SRS') setPanel('sector')

      const simple: Record<string, Command> = {
        SRS: { type: 'srs' },
        LRS: { type: 'lrs' },
        DAM: { type: 'damage' },
        COM: { type: 'chart' },
        XXX: { type: 'resign' },
      }
      onCommand(simple[cmd]!, [echo(answer)])
      return
    }

    const value = Number(answer)
    if (!Number.isFinite(value)) {
      onPrint([echo(answer), { kind: 'system', text: 'A NUMBER, PLEASE.' }])
      return
    }

    switch (ask) {
      case 'nav-course':
        onPrint([echo(answer)])
        setCourse(value)
        setAsk('nav-warp')
        break
      case 'nav-warp':
        onCommand({ type: 'nav', course, warp: value }, [echo(answer)])
        setPanel('sector')
        setAsk('command')
        break
      case 'tor-course':
        onCommand({ type: 'torpedo', course: value }, [echo(answer)])
        setAsk('command')
        break
      case 'beams':
        onCommand({ type: 'beams', energy: value }, [echo(answer)])
        setAsk('command')
        break
      case 'shields':
        onCommand({ type: 'shields', energy: value }, [echo(answer)])
        setAsk('command')
        break
    }
  }

  return (
    <div className="console">
      {skin === 'modern' ? (
        <div className="bridge">
          <ShipPanel patrol={patrol} captainName={captainName} />
          <TacticalView
            patrol={patrol}
            panel={panel}
            onPanel={setPanel}
            onSector={clickSector}
            onQuadrant={clickQuadrant}
          />
          <LogPanel lines={transcript} />
        </div>
      ) : (
        <>
          <Teletype lines={transcript} clatter />

          {/*
            A concession, and the only one on this skin: the machine printed
            the ship's numbers beside a short range scan and nowhere else, so
            the 1971 way to know your energy was to remember it or spend a
            command asking. That is fine on paper you can hold and unkind on a
            phone, where the answer has already scrolled. The scan is still
            the only place the *galaxy* appears; this strip only ever says
            what is true of the ship.
          */}
          <div className="statusbar">
            <span>{captainName}</span>
            <span>STARDATE {patrol.day.toFixed(1)}</span>
            <span>DAYS {daysLeft(patrol).toFixed(1)}</span>
            <span>ENERGY {Math.round(patrol.energy)}</span>
            <span>SHIELDS {Math.round(patrol.shields)}</span>
            <span>TORP {patrol.torpedoes}</span>
            <span>RAIDERS {patrol.raidersLeft}</span>
            <span className={condition(patrol) === 'RED' ? 'senses' : ''}>
              {condition(patrol)}
            </span>
          </div>
        </>
      )}

      {/*
        The prompt never goes away while the patrol is running, even mid-print.
        Hiding it until the printer catches up is the obvious thing and it is
        wrong: a terminal took type-ahead, and somebody who already knows they
        want SRS should not have their keystrokes eaten because the machine is
        still hammering out the last line. It cost two commands to find that
        out by playing it.
      */}
      {!over && (
        <div className="prompt">
          <div className="prompt-row">
            <span className="prompt-q">{QUESTION[ask]} ?</span>
            <input
              ref={input}
              className="field-input"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submit()
              }}
              aria-label={QUESTION[ask]}
              autoComplete="off"
              spellCheck={false}
            />
          </div>

          {/*
            The nine, as buttons. A terminal had a keyboard and a phone does
            not, and making somebody thumb-type NAV forty times is not
            faithfulness, it is an obstacle the original never had. Typing
            still works and is still the way it is meant to be played.

            On the remaster they become an action bar instead, because half
            of them have been replaced by pointing at the thing: NAV and TOR
            are a click on the grid, and SRS is the grid.
          */}
          {ask === 'command' &&
            (skin === 'modern' ? (
              <ActionBar
                patrol={patrol}
                onSimple={simpleClick}
                onSpend={spend}
                onBlip={onBlip}
              />
            ) : (
              <div className="keys">
                {COMMANDS.map(([id, what]) => (
                  <button
                    key={id}
                    className="btn btn-ghost key"
                    title={what}
                    onClick={() => {
                      onBlip()
                      submit(id)
                    }}
                  >
                    {id}
                  </button>
                ))}
              </div>
            ))}
        </div>
      )}
    </div>
  )
}

/**
 * Where to tie up.
 *
 * A starbase is moored *alongside*, never on, so clicking one has to pick a
 * sector next to it -- and not any sector next to it, because most of them
 * are as far from you as the base is. This takes the free berth nearest to
 * where the ship already is, which is the one a player working it out on
 * paper would have chosen.
 */
function mooringFor(patrol: Patrol, base: Coord): Coord | null {
  const berths: Coord[] = []
  for (let row = base.row - 1; row <= base.row + 1; row++) {
    for (let col = base.col - 1; col <= base.col + 1; col++) {
      const at = { row, col }
      if (row < 0 || row >= SECTORS || col < 0 || col >= SECTORS) continue
      if (same(at, base)) continue
      if (occupant(patrol, at) !== null && !same(at, patrol.sector)) continue
      berths.push(at)
    }
  }
  if (berths.length === 0) return null

  return berths.reduce((best, at) =>
    Math.hypot(at.row - patrol.sector.row, at.col - patrol.sector.col) <
    Math.hypot(best.row - patrol.sector.row, best.col - patrol.sector.col)
      ? at
      : best,
  )
}

/**
 * The remaster's action bar: the commands that are not a place.
 *
 * NAV, TOR and SRS are gone from it because they became pointing -- warping
 * somewhere, shooting at something, and looking at where you are, all of
 * which now have a thing on screen to click. What is left is the four that
 * are not about a position, plus the two that spend energy.
 *
 * Those two ask "how much", which on paper is a second prompt and here is a
 * row of amounts. They are amounts rather than a slider on purpose: energy
 * is spent in round numbers and read back as a bar, and dragging for a
 * precise 437 would be a worse version of typing it -- which still works.
 */
function ActionBar({
  patrol,
  onSimple,
  onSpend,
  onBlip,
}: {
  patrol: Patrol
  onSimple: (id: string, cmd: Command) => void
  onSpend: (kind: 'beams' | 'shields', amount: number) => void
  onBlip: () => void
}) {
  const [armed, setArmed] = useState<'beams' | 'shields' | null>(null)

  const arm = (which: 'beams' | 'shields') => {
    onBlip()
    setArmed((a) => (a === which ? null : which))
  }

  const fire = (amount: number) => {
    if (!armed) return
    onSpend(armed, Math.max(0, Math.floor(amount)))
    setArmed(null)
  }

  const pool = armed === 'shields' ? patrol.energy + patrol.shields : patrol.energy
  const presets = [250, 500, 1000].filter((n) => n <= pool)

  return (
    <div className="actions">
      <div className="action-row">
        <button className="btn btn-ghost key" onClick={() => arm('beams')}>
          BEAMS
        </button>
        <button className="btn btn-ghost key" onClick={() => arm('shields')}>
          SHIELDS
        </button>
        <button
          className="btn btn-ghost key"
          onClick={() => onSimple('LRS', { type: 'lrs' })}
          title="Scan the nine quadrants around this one"
        >
          LONG RANGE
        </button>
        <button
          className="btn btn-ghost key"
          onClick={() => onSimple('COM', { type: 'chart' })}
          title="The chart, and where you are on it"
        >
          CHART
        </button>
        <button className="btn btn-ghost key" onClick={() => onSimple('DAM', { type: 'damage' })}>
          DAMAGE
        </button>
        <button
          className="btn btn-ghost key"
          onClick={() => onSimple('XXX', { type: 'resign' })}
          title="Break off and go home"
        >
          BREAK OFF
        </button>
      </div>

      {armed && (
        <div className="action-row amounts">
          <span className="panel-label">
            {armed === 'beams' ? 'UNITS TO FIRE' : 'UNITS TO SHIELDS'}
          </span>
          {presets.map((n) => (
            <button className="btn btn-ghost key" key={n} onClick={() => fire(n)}>
              {n}
            </button>
          ))}
          {armed === 'beams' ? (
            <button className="btn btn-ghost key" onClick={() => fire(patrol.energy / 2)}>
              HALF
            </button>
          ) : (
            <button className="btn btn-ghost key" onClick={() => fire(0)}>
              DOWN
            </button>
          )}
          <button className="btn btn-ghost key cancel" onClick={() => setArmed(null)}>
            CANCEL
          </button>
        </div>
      )}
    </div>
  )
}
