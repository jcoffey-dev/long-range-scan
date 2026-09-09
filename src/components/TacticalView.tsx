import { GALAXY, SECTORS } from '../game/constants'
import { censusCode } from '../game/galaxy'
import { condition } from '../game/engine'
import type { Patrol } from '../game/types'

/**
 * The remaster: the sensors, drawn.
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
 * Drawing the truth would make the remaster an easier game than the
 * original, and they are meant to be the same game.
 */

const CELL = 40
const HALF = CELL / 2

export function TacticalView({
  patrol,
  panel,
  onPanel,
}: {
  patrol: Patrol
  panel: 'sector' | 'galaxy'
  onPanel: (p: 'sector' | 'galaxy') => void
}) {
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
      {panel === 'sector' ? <SectorGrid patrol={patrol} /> : <GalaxyGrid patrol={patrol} />}
    </div>
  )
}

/** The quadrant you are standing in, at sector resolution. */
function SectorGrid({ patrol }: { patrol: Patrol }) {
  const size = CELL * SECTORS

  if (patrol.damage.srs > 0) {
    return <Dark label="SHORT RANGE SENSORS ARE OUT" size={size} />
  }

  const at = (c: { row: number; col: number }) => ({
    x: c.col * CELL + HALF,
    y: c.row * CELL + HALF,
  })

  return (
    <svg
      className="grid-map"
      viewBox={`-6 -6 ${size + 12} ${size + 12}`}
      role="img"
      aria-label={`Sector scan of quadrant ${patrol.quadrant.row + 1},${patrol.quadrant.col + 1}. You are in sector ${patrol.sector.row + 1},${patrol.sector.col + 1}.`}
    >
      <rect className="grid-bg" x="-6" y="-6" width={size + 12} height={size + 12} rx="12" />
      <Rules n={SECTORS} size={size} />

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
        <g className="mark mark-base" transform={`translate(${at(patrol.base).x} ${at(patrol.base).y})`}>
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
        transform={`translate(${at(patrol.sector).x} ${at(patrol.sector).y})`}
      >
        <circle className="ring" r="17" />
        <path className="hull" d="M0 -15 L12 12 L0 5.5 L-12 12 Z" />
        <path className="lit" d="M0 -15 L0 5.5 L-12 12 Z" />
      </g>
    </svg>
  )
}

/** The chart: what has been scanned, three digits at a time. */
function GalaxyGrid({ patrol }: { patrol: Patrol }) {
  const size = CELL * GALAXY

  if (patrol.damage.computer > 0) {
    return <Dark label="THE COMPUTER IS DOWN" size={size} />
  }

  const cells = []
  for (let row = 0; row < GALAXY; row++) {
    for (let col = 0; col < GALAXY; col++) {
      const census = patrol.chart[row]![col]!
      const here = row === patrol.quadrant.row && col === patrol.quadrant.col
      const classes = [
        'quad',
        census === null ? 'unknown' : '',
        census && census.raiders > 0 ? 'hostile' : '',
        census?.base ? 'has-base' : '',
        here ? 'here' : '',
      ]
        .filter(Boolean)
        .join(' ')

      cells.push(
        <g className={classes} key={`${row}-${col}`}>
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
function angle(from: { row: number; col: number }, to: { row: number; col: number }): number {
  return (Math.atan2(to.row - from.row, to.col - from.col) * 180) / Math.PI
}
