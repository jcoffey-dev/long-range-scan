import { useEffect, useRef } from 'react'
import type { Line } from '../game/types'

/**
 * The remaster's right-hand column: what the machine has said.
 *
 * Two deliberate differences from the paper, and they are the whole reason
 * the remaster is readable:
 *
 * **The scans are not in here.** A short range scan is eight rows of
 * three-character columns and a long range scan is a nine-cell block of
 * digits; on paper that is the only way to show a grid, and on a screen it is
 * a picture of a grid rendered in text next to an actual grid. So `scan`
 * lines are drawn by `TacticalView` instead. Both skins are told exactly the
 * same things -- one of them draws the part that is a diagram.
 *
 * **Nothing types.** The print head is 1971's, and it is the right sound and
 * the right speed for paper. Here the lines land, because you are reading
 * this column while looking at the grid next to it, and a line that arrives
 * one character at a time in the corner of your eye is a distraction rather
 * than a machine.
 */
export function LogPanel({ lines }: { lines: Line[] }) {
  const box = useRef<HTMLDivElement>(null)
  const shown = lines.filter((l) => l.kind !== 'scan')

  useEffect(() => {
    box.current?.scrollTo({ top: box.current.scrollHeight, behavior: 'smooth' })
  }, [shown.length])

  return (
    <aside className="panel log-panel">
      <h2 className="panel-title">LOG</h2>
      <div className="log-lines" ref={box} aria-live="polite">
        {shown.map((l, i) => (
          <p className={`log-line log-${l.kind}`} key={i}>
            {l.text}
          </p>
        ))}
      </div>
    </aside>
  )
}
