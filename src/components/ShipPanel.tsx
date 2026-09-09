import { DEVICE_NAMES, START_ENERGY, START_TORPEDOES } from '../game/constants'
import { condition, daysLeft } from '../game/engine'
import { DEVICES, type Patrol } from '../game/types'

/**
 * The remaster's left-hand column: everything true of the ship.
 *
 * On paper this was a strip of text down the side of a short range scan,
 * eight facts on eight rows, because that is what a printing terminal could
 * do. Given a screen and no printer, the two numbers you actually watch --
 * energy and shields -- become bars, because a bar answers "how much is
 * left" without being read, and that is the question you ask forty times a
 * patrol.
 *
 * Nothing here is new information. It is the same eight facts, plus the
 * damage report, which in 1971 cost you a command to ask for and here does
 * not.
 */
export function ShipPanel({ patrol, captainName }: { patrol: Patrol; captainName: string }) {
  const cond = condition(patrol)
  const broken = DEVICES.filter((d) => patrol.damage[d] > 0)

  return (
    <aside className="panel ship-panel">
      <h2 className="panel-title">{captainName}</h2>

      <div className={`condition cond-${cond.toLowerCase()}`}>{cond}</div>

      <Bar label="ENERGY" value={patrol.energy} of={START_ENERGY} kind="energy" />
      <Bar label="SHIELDS" value={patrol.shields} of={START_ENERGY} kind="shields" />

      <dl className="readout">
        <dt>STARDATE</dt>
        <dd>{patrol.day.toFixed(1)}</dd>
        <dt>DAYS LEFT</dt>
        <dd className={daysLeft(patrol) < 5 ? 'low' : ''}>{daysLeft(patrol).toFixed(1)}</dd>
        <dt>QUADRANT</dt>
        <dd>
          {patrol.quadrant.row + 1},{patrol.quadrant.col + 1}
        </dd>
        <dt>SECTOR</dt>
        <dd>
          {patrol.sector.row + 1},{patrol.sector.col + 1}
        </dd>
        <dt>RAIDERS</dt>
        <dd className="big">{patrol.raidersLeft}</dd>
      </dl>

      {/* Torpedoes are countable, so they are counted rather than measured. */}
      <div className="torps" title={`${patrol.torpedoes} torpedoes`}>
        <span className="panel-label">TORPEDOES</span>
        <span className="pips" aria-label={`${patrol.torpedoes} torpedoes`}>
          {Array.from({ length: START_TORPEDOES }, (_, i) => (
            <i key={i} className={i < patrol.torpedoes ? 'pip on' : 'pip'} />
          ))}
        </span>
      </div>

      <div className="damage-list">
        <span className="panel-label">DAMAGE</span>
        {broken.length === 0 ? (
          <p className="all-well">ALL SYSTEMS ANSWER</p>
        ) : (
          <ul>
            {broken.map((d) => (
              <li key={d}>
                <span>{DEVICE_NAMES[d]}</span>
                <span className="days">{patrol.damage[d]!.toFixed(1)}d</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  )
}

function Bar({
  label,
  value,
  of,
  kind,
}: {
  label: string
  value: number
  of: number
  kind: string
}) {
  const pct = Math.max(0, Math.min(100, (value / of) * 100))
  return (
    <div className="meter">
      <div className="meter-head">
        <span className="panel-label">{label}</span>
        <span className="meter-value">{Math.round(value)}</span>
      </div>
      <div
        className={`bar bar-${kind}`}
        role="meter"
        aria-valuenow={Math.round(value)}
        aria-valuemin={0}
        aria-valuemax={of}
        aria-label={label}
      >
        <span style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}
