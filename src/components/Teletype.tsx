import { useEffect, useRef, useState } from 'react'
import type { Line } from '../game/types'

/**
 * The 1971 skin: everything the machine has said, printed.
 *
 * A printing terminal runs at ten characters a second and cannot take any of
 * it back, so this types rather than appears, and nothing already printed
 * ever changes. That is not decoration -- it is the reason the game feels the
 * way it does. A short range scan arriving row by row is a different
 * experience from finding the whole grid already on the page, and this game
 * is eleven lines of grid arriving while something shoots at you.
 *
 * A scan is exempt. Eight rows of it at reading speed is most of a minute,
 * and the original's printer was hammering all eight out while the captain
 * was already deciding -- so the grid lands whole and the sentences type.
 */
const CPS = 60 // Faster than a real ASR-33. A real one is 10, and it is a lot.

export function Teletype({ lines }: { lines: Line[] }) {
  const [printed, setPrinted] = useState<string[]>([])
  const [partial, setPartial] = useState('')
  const done = useRef(0)
  const paper = useRef<HTMLDivElement>(null)

  // A new patrol throws the old transcript away rather than scrolling it.
  useEffect(() => {
    if (lines.length < done.current) {
      done.current = 0
      setPrinted([])
      setPartial('')
    }
  }, [lines.length])

  useEffect(() => {
    if (done.current >= lines.length) return
    const next = lines[done.current]!

    if (next.kind === 'scan') {
      done.current += 1
      setPrinted((p) => [...p, next.text])
      return
    }

    const text = next.text
    let at = 0
    setPartial('')

    const timer = window.setInterval(() => {
      at += 1
      setPartial(text.slice(0, at))
      if (at >= text.length) {
        window.clearInterval(timer)
        done.current += 1
        setPartial('')
        setPrinted((p) => [...p, text])
      }
    }, 1000 / CPS)

    return () => window.clearInterval(timer)
    // `printed` is the trigger: finishing one line starts the next.
  }, [lines, printed.length])

  // The paper feeds up; you always read at the bottom.
  useEffect(() => {
    paper.current?.scrollTo({ top: paper.current.scrollHeight })
  }, [printed.length, partial])

  return (
    <div className="paper" ref={paper}>
      {printed.map((text, i) => (
        <div className="printed" key={i}>
          {text}
        </div>
      ))}
      {partial && (
        <div className="printed">
          {partial}
          <span className="head" aria-hidden />
        </div>
      )}
    </div>
  )
}
