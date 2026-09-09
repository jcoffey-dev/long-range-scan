import { useEffect, useRef, useState } from 'react'
import { condition, daysLeft } from '../game/engine'
import type { Command, Line, Patrol } from '../game/types'
import { Teletype } from './Teletype'

/**
 * The console: the paper, and the one line you are allowed to type on.
 *
 * The original asks for a command and then asks for whatever that command
 * needs, one question at a time -- COMMAND, then COURSE, then WARP FACTOR --
 * because a printing terminal has no form to fill in and no way back to a
 * field you have already left. That is kept exactly, and it is why this
 * component is a tiny state machine rather than a set of inputs.
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
}: {
  patrol: Patrol
  transcript: Line[]
  captainName: string
  /** The patrol has ended. There is nothing left to ask. */
  over: boolean
  onCommand: (cmd: Command, echo: Line[]) => void
  onPrint: (lines: Line[]) => void
}) {
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
      <Teletype lines={transcript} />

      {/*
        A concession, and the only one: the machine printed the ship's numbers
        beside a short range scan and nowhere else, so the 1971 way to know
        your energy was to remember it or spend a command asking. That is fine
        on paper you can hold and unkind on a phone, where the answer has
        already scrolled. The scan is still the only place the *galaxy*
        appears; this strip only ever says what is true of the ship.
      */}
      <div className="statusbar">
        <span>{captainName}</span>
        <span>STARDATE {patrol.day.toFixed(1)}</span>
        <span>DAYS {daysLeft(patrol).toFixed(1)}</span>
        <span>ENERGY {Math.round(patrol.energy)}</span>
        <span>SHIELDS {Math.round(patrol.shields)}</span>
        <span>TORP {patrol.torpedoes}</span>
        <span>RAIDERS {patrol.raidersLeft}</span>
        <span className={condition(patrol) === 'RED' ? 'senses' : ''}>{condition(patrol)}</span>
      </div>

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
          */}
          {ask === 'command' && (
            <div className="keys">
              {COMMANDS.map(([id, what]) => (
                <button
                  key={id}
                  className="btn btn-ghost key"
                  title={what}
                  onClick={() => submit(id)}
                >
                  {id}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
