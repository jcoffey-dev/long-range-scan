import { useState } from 'react'
import { navFor } from '../game/aim'
import { GALAXY, SECTORS } from '../game/constants'
import { adjacent, censusCode, occupant, same, type Occupant } from '../game/galaxy'
import { condition } from '../game/engine'
import type { Coord, Patrol } from '../game/types'

/**
 * The remaster: the sensors, drawn, and clickable.
 *
 * Every mark here is generated from the game state -- there is no artwork
 * file in this repository and there is not going to be one. Cel shading in
 * practice means flat fills, one heavy outline, and a highlight that is a
 * second flat fill rather than a gradient, which is a style that happens to
 * suit a thing made entirely of `<circle>` and `<path>`.
 *
 * The hard rule is that this component may not show the player anything the
 * teletype has not already offered, and here that rule has teeth, because
 * these two panels *are* two of the ship's devices:
 *
 *   - the sector grid is the short range sensors. Break them and it goes
 *     dark, exactly as SRS refuses to print;
 *   - the chart is the computer, and it draws `patrol.chart` -- what has
 *     been scanned -- rather than `patrol.galaxy`, which is the truth. An
 *     unscanned quadrant is three dots on both skins.
 *
 * Clicking is not a second way to play. A click is turned into a course and
 * a warp factor a player could have typed, at the same precision the prompt
 * accepts, and the log prints the questions and the answers as though they
 * had -- see `game/aim.ts`. The readout under the grid says what the click
 * is about to become before it becomes it, which is how anybody learns that
 * course 3 is north.
 */

const CELL = 40
const HALF = CELL / 2

export type SectorClick = { at: Coord; what: Occupant }

export function TacticalView({
  patrol,
  panel,
  onPanel,
  onSector,
  onQuadrant,
}: {
  patrol: Patrol
  panel: 'sector' | 'galaxy'
  onPanel: (p: 'sector' | 'galaxy') => void
  onSector: (click: SectorClick) => void
  onQuadrant: (at: Coord) => void
}) {
  const [hover, setHover] = useState<Coord | null>(null)

  return (
    <div className="tactical">
      <div className="panel-tabs">
        <button
          className={`btn btn-ghost tab ${panel === 'sector' ? 'on' : ''}`}
          onClick={() => onPanel('sector')}
        >
          SECTOR
        </button>
        <button
          className={`btn btn-ghost tab ${panel === 'galaxy' ? 'on' : ''}`}
          onClick={() => onPanel('galaxy')}
        >
          GALAXY
        </button>
      </div>

      {panel === 'sector' ? (
        <SectorGrid patrol={patrol} hover={hover} onHover={setHover} onSector={onSector} />
      ) : (
        <GalaxyGrid patrol={patrol} hover={hover} onHover={setHover} onQuadrant={onQuadrant} />
      )}

      <p className="aim-readout">{caption(patrol, panel, hover)}</p>
    </div>
  )
}

/** What the click under the pointer would do, in the machine's own terms. */
function caption(patrol: Patrol, panel: 'sector' | 'galaxy', hover: Coord | null): string {
  if (!hover) return panel === 'sector' ? 'CLICK A SECTOR' : 'CLICK A QUADRANT'

  if (panel === 'galaxy') {
    const d = {
      row: (hover.row - patrol.quadrant.row) * SECTORS,
      col: (hover.col - patrol.quadrant.col) * SECTORS,
    }
    if (d.row === 0 && d.col === 0) return 'YOU ARE HERE'
    const { course, warp } = navFor(d)
    return `NAV  COURSE ${course}  WARP ${warp}`
  }

  const what = occupant(patrol, hover)
  if (what === 'ship') return 'YOU ARE HERE'
  if (what === 'star') return 'A STAR. NOTHING GOES THROUGH IT.'

  const d = { row: hover.row - patrol.sector.row, col: hover.col - patrol.sector.col }
  if (what === 'raider') return `TORPEDO  COURSE ${navFor(d).course}`
  if (what === 'base') return adjacent(patrol.sector, hover) ? 'ALREADY MOORED' : 'MOOR ALONGSIDE'

  const { course, warp } = navFor(d)
  return `NAV  COURSE ${course}  WARP ${warp}`
}

/** The quadrant you are standing in, at sector resolution. */
function SectorGrid({
  patrol,
  hover,
  onHover,
  onSector,
}: {
  patrol: Patrol
  hover: Coord | null
  onHover: (c: Coord | null) => void
  onSector: (click: SectorClick) => void
}) {
  const size = CELL * SECTORS

  if (patrol.damage.srs > 0) {
    return <Dark label="SHORT RANGE SENSORS ARE OUT" size={size} />
  }

  const at = (c: Coord) => ({ x: c.col * CELL + HALF, y: c.row * CELL + HALF })
  const me = at(patrol.sector)

  const cells = []
  for (let row = 0; row < SECTORS; row++) {
    for (let col = 0; col < SECTORS; col++) {
      const cell = { row, col }
      const what = occupant(patrol, cell)
      const dead = what === 'ship' || what === 'star'
      cells.push(
        <rect
          className={`cell ${dead ? 'cell-dead' : ''} ${hover && same(hover, cell) ? 'on' : ''}`}
          key={`${row}-${col}`}
          x={col * CELL}
          y={row * CELL}
          width={CELL}
          height={CELL}
          onMouseEnter={() => onHover(cell)}
          onMouseLeave={() => onHover(null)}
          onClick={() => onSector({ at: cell, what })}
        />,
      )
    }
  }

  return (
    <svg
      className="grid-map"
      viewBox={`-6 -6 ${size + 12} ${size + 12}`}
      role="img"
      aria-label={`Sector scan of quadrant ${patrol.quadrant.row + 1},${patrol.quadrant.col + 1}. You are in sector ${patrol.sector.row + 1},${patrol.sector.col + 1}.`}
    >
      <rect className="grid-bg" x="-6" y="-6" width={size + 12} height={size + 12} rx="12" />
      <Rules n={SECTORS} size={size} />

      {/* The course, drawn before it is flown. */}
      {hover && !same(hover, patrol.sector) && occupant(patrol, hover) !== 'star' && (
        <g className="aim">
          <line x1={me.x} y1={me.y} x2={at(hover).x} y2={at(hover).y} />
          <circle cx={at(hover).x} cy={at(hover).y} r="15" />
        </g>
      )}

      {patrol.stars.map((s, i) => {
        const { x, y } = at(s)
        return (
          <g className="mark mark-star" key={`s${i}`}>
            <circle cx={x} cy={y} r="9" />
            {/* The highlight is a second flat fill, not a gradient. */}
            <circle className="lit" cx={x - 3} cy={y - 3.5} r="3.2" />
          </g>
        )
      })}

      {patrol.base && (
        <g
          className="mark mark-base"
          transform={`translate(${at(patrol.base).x} ${at(patrol.base).y})`}
        >
          <path d="M0 -12 L10.4 -6 L10.4 6 L0 12 L-10.4 6 L-10.4 -6 Z" />
          <circle className="lit" cx="0" cy="0" r="4.4" />
        </g>
      )}

      {patrol.raiders.map((k, i) => {
        const { x, y } = at(k.at)
        return (
          <g className="mark mark-raider" key={`r${i}`} transform={`translate(${x} ${y})`}>
            {/* A dart, turned to face the ship, so a quadrant reads as a
                fight rather than as a list of objects. Which way a raider is
                pointing is decoration -- it has no facing in the rules -- but
                it is decoration that tells the truth: it is coming for you. */}
            <path
              d="M15 0 L-9 -11 L-4 0 L-9 11 Z"
              transform={`rotate(${angle(k.at, patrol.sector)})`}
            />
          </g>
        )
      })}

      {/*
        Your ship, pointing up and staying that way. The first draft drew a
        saucer with a hull under it and at this size it read as a hamburger:
        two stacked shapes of similar width, the lower one darker. An
        arrowhead has one silhouette and survives being sixteen pixels tall,
        which is the only test that matters here.
      */}
      <g
        className={`mark mark-ship ${condition(patrol) === 'RED' ? 'red' : ''}`}
        transform={`translate(${me.x} ${me.y})`}
      >
        <circle className="ring" r="17" />
        <path className="hull" d="M0 -15 L12 12 L0 5.5 L-12 12 Z" />
        <path className="lit" d="M0 -15 L0 5.5 L-12 12 Z" />
      </g>

      {/* Last, so nothing is drawn over the thing taking the clicks. */}
      {cells}
    </svg>
  )
}

/** The chart: what has been scanned, three digits at a time. */
function GalaxyGrid({
  patrol,
  hover,
  onHover,
  onQuadrant,
}: {
  patrol: Patrol
  hover: Coord | null
  onHover: (c: Coord | null) => void
  onQuadrant: (at: Coord) => void
}) {
  const size = CELL * GALAXY

  if (patrol.damage.computer > 0) {
    return <Dark label="THE COMPUTER IS DOWN" size={size} />
  }

  const cells = []
  for (let row = 0; row < GALAXY; row++) {
    for (let col = 0; col < GALAXY; col++) {
      const cell = { row, col }
      const census = patrol.chart[row]![col]!
      const here = same(cell, patrol.quadrant)
      const classes = [
        'quad',
        census === null ? 'unknown' : '',
        census && census.raiders > 0 ? 'hostile' : '',
        census?.base ? 'has-base' : '',
        here ? 'here' : '',
        hover && same(hover, cell) ? 'on' : '',
      ]
        .filter(Boolean)
        .join(' ')

      cells.push(
        <g
          className={classes}
          key={`${row}-${col}`}
          onMouseEnter={() => onHover(cell)}
          onMouseLeave={() => onHover(null)}
          onClick={() => !here && onQuadrant(cell)}
        >
          <rect x={col * CELL + 2} y={row * CELL + 2} width={CELL - 4} height={CELL - 4} rx="5" />
          <text x={col * CELL + HALF} y={row * CELL + HALF + 4}>
            {census === null ? '···' : censusCode(census)}
          </text>
        </g>,
      )
    }
  }

  return (
    <svg
      className="grid-map"
      viewBox={`-6 -6 ${size + 12} ${size + 12}`}
      role="img"
      aria-label={`Galaxy chart. You are in quadrant ${patrol.quadrant.row + 1},${patrol.quadrant.col + 1}. ${patrol.raidersLeft} raiders remain.`}
    >
      <rect className="grid-bg" x="-6" y="-6" width={size + 12} height={size + 12} rx="12" />
      {cells}
    </svg>
  )
}

/** A device that is out. The panel is the device, so it goes dark with it. */
function Dark({ label, size }: { label: string; size: number }) {
  return (
    <svg
      className="grid-map"
      viewBox={`-6 -6 ${size + 12} ${size + 12}`}
      role="img"
      aria-label={label}
    >
      <rect className="grid-bg dead" x="-6" y="-6" width={size + 12} height={size + 12} rx="12" />
      <text className="dead-label" x={size / 2} y={size / 2}>
        {label}
      </text>
    </svg>
  )
}

function Rules({ n, size }: { n: number; size: number }) {
  const lines = []
  for (let i = 1; i < n; i++) {
    lines.push(<line className="rule" key={`h${i}`} x1="0" y1={i * CELL} x2={size} y2={i * CELL} />)
    lines.push(<line className="rule" key={`v${i}`} x1={i * CELL} y1="0" x2={i * CELL} y2={size} />)
  }
  return <g>{lines}</g>
}

/** Degrees from a raider towards the ship, for the dart to point along. */
function angle(from: Coord, to: Coord): number {
  return (Math.atan2(to.row - from.row, to.col - from.col) * 180) / Math.PI
}
