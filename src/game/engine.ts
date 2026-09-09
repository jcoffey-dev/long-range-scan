import {
  BEAM_FLOOR,
  BLOCKED_TEXT,
  CRIPPLED_WARP,
  DAMAGE_CHANCE,
  DAMAGE_DAYS,
  DEVICE_NAMES,
  DOCKED_TEXT,
  DOCK_REPAIR_DAYS,
  EDGE_TEXT,
  GALAXY,
  GLYPH,
  LOW_ENERGY,
  MAX_WARP,
  MIN_DAYS,
  MAX_EXTRA_DAYS,
  NO_SUCH_COURSE,
  OUTCOME_TEXT,
  SECTORS,
  SHIELDS_DOWN_TEXT,
  START_ENERGY,
  START_TORPEDOES,
  WARP_COST_FIXED,
  WARP_COST_PER_SECTOR,
} from './constants'
import {
  adjacent,
  censusCode,
  distance,
  heading,
  inGalaxy,
  layQuadrant,
  makeGalaxy,
  occupant,
  randomCoord,
  same,
} from './galaxy'
import type { Rng } from './rng'
import {
  DEVICES,
  type Captain,
  type Command,
  type Condition,
  type Coord,
  type DeviceId,
  type Line,
  type Outcome,
  type Patrol,
} from './types'

export const randomSeed = () => Math.floor(Math.random() * 0x7fffffff)

const line = (kind: Line['kind'], text: string): Line => ({ kind, text })

/** One-based, and printed the way the machine prints it: row then column. */
const say = (c: Coord) => `${c.row + 1},${c.col + 1}`

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))

/** Sectors are whole; a course is not. Round on arrival, never on the way. */
const round = (c: Coord): Coord => ({ row: Math.round(c.row), col: Math.round(c.col) })

// ---------------------------------------------------------------- setting up

export function makePatrol(rng: Rng): Patrol {
  const { galaxy, raiders, bases } = makeGalaxy(rng)
  const day = (20 + Math.floor(rng() * 20)) * 100
  const damage = Object.fromEntries(DEVICES.map((d) => [d, 0])) as Record<DeviceId, number>

  const patrol: Patrol = {
    day,
    deadline: day + MIN_DAYS + Math.floor(rng() * MAX_EXTRA_DAYS),
    galaxy,
    chart: Array.from({ length: GALAXY }, () => Array.from({ length: GALAXY }, () => null)),
    quadrant: randomCoord(rng, GALAXY),
    sector: randomCoord(rng),
    energy: START_ENERGY,
    shields: 0,
    torpedoes: START_TORPEDOES,
    damage,
    raiders: [],
    stars: [],
    base: null,
    docked: false,
    raidersLeft: raiders,
    raidersKilled: 0,
    basesLeft: bases,
    outcome: null,
  }

  return arrive(patrol, rng).patrol
}

/**
 * Come out of warp: lay the quadrant out, write it on the chart, and find out
 * whether anything here has noticed. Being in a quadrant is what charts it --
 * the long range scan is for the eight you are *not* in.
 */
export function arrive(patrol: Patrol, rng: Rng): { patrol: Patrol; lines: Line[] } {
  let next = layQuadrant(patrol, rng)
  const { row, col } = next.quadrant
  const chart = next.chart.map((r) => r.slice())
  chart[row]![col] = { ...next.galaxy[row]![col]! }
  next = { ...next, chart }

  const lines: Line[] = []
  next = redock(next, lines)

  if (next.raiders.length > 0 && !next.docked) {
    lines.push(
      line(
        'hit',
        `CONDITION RED. ${next.raiders.length} RAIDER${next.raiders.length > 1 ? 'S' : ''} IN THIS QUADRANT.`,
      ),
    )
  }

  return { patrol: next, lines }
}

/** Moored, if there is a starbase in the next sector over. */
function redock(patrol: Patrol, lines: Line[]): Patrol {
  const docked = patrol.base !== null && adjacent(patrol.sector, patrol.base)
  if (!docked) return { ...patrol, docked: false }
  if (patrol.docked) return patrol

  lines.push(line('system', DOCKED_TEXT))
  const damage = { ...patrol.damage }
  for (const d of DEVICES) damage[d] = Math.max(0, damage[d] - DOCK_REPAIR_DAYS)
  return {
    ...patrol,
    docked: true,
    energy: START_ENERGY,
    torpedoes: START_TORPEDOES,
    shields: 0,
    damage,
  }
}

export function condition(patrol: Patrol): Condition {
  if (patrol.docked) return 'DOCKED'
  if (patrol.raiders.length > 0) return 'RED'
  if (patrol.energy < START_ENERGY * LOW_ENERGY) return 'YELLOW'
  return 'GREEN'
}

// ------------------------------------------------------------------- scanning

/**
 * The short range scan, and the status board printed down its right-hand side.
 *
 * Eight rows of sectors and eight facts about the ship, one to a row, because
 * that is what fits on a line of paper and because a printing terminal has no
 * second place to put anything. This is the screen of the game: everything a
 * captain decides is decided off these eleven lines.
 */
export function shortRangeScan(patrol: Patrol): Line[] {
  if (patrol.damage.srs > 0) {
    return [line('system', 'SHORT RANGE SENSORS ARE OUT. NOTHING TO SEE BY.')]
  }

  const status = [
    `STARDATE    ${patrol.day.toFixed(1)}`,
    `CONDITION   ${condition(patrol)}`,
    `QUADRANT    ${say(patrol.quadrant)}`,
    `SECTOR      ${say(patrol.sector)}`,
    `ENERGY      ${Math.round(patrol.energy)}`,
    `SHIELDS     ${Math.round(patrol.shields)}`,
    `TORPEDOES   ${patrol.torpedoes}`,
    `RAIDERS     ${patrol.raidersLeft}`,
  ]

  const rule = '-'.repeat(SECTORS * 4 + 1)
  const lines = [line('scan', rule)]

  for (let row = 0; row < SECTORS; row++) {
    let text = ''
    for (let col = 0; col < SECTORS; col++) {
      const who = occupant(patrol, { row, col })
      text +=
        who === 'ship'
          ? GLYPH.ship
          : who === 'raider'
            ? GLYPH.raider
            : who === 'base'
              ? GLYPH.base
              : who === 'star'
                ? GLYPH.star
                : GLYPH.empty
      text += ' '
    }
    lines.push(line('scan', `${text}  ${status[row]}`))
  }

  lines.push(line('scan', rule))
  return lines
}

/**
 * The long range scan: three digits a quadrant, for the nine quadrants
 * centred on this one. Raiders, starbases, stars, in that order and no
 * spaces -- 205 is two raiders, no base, five stars, and reading those three
 * digits at a glance is the skill the whole game is built on.
 */
export function longRangeScan(patrol: Patrol): { patrol: Patrol; lines: Line[] } {
  if (patrol.damage.lrs > 0) {
    return { patrol, lines: [line('system', 'LONG RANGE SENSORS ARE OUT.')] }
  }

  const chart = patrol.chart.map((r) => r.slice())
  const lines: Line[] = [line('scan', `LONG RANGE SCAN FOR QUADRANT ${say(patrol.quadrant)}`)]
  const rule = '-------------------'

  lines.push(line('scan', rule))
  for (let dr = -1; dr <= 1; dr++) {
    let text = ':'
    for (let dc = -1; dc <= 1; dc++) {
      const q = { row: patrol.quadrant.row + dr, col: patrol.quadrant.col + dc }
      if (!inGalaxy(q)) {
        text += ' *** :'
        continue
      }
      const census = patrol.galaxy[q.row]![q.col]!
      chart[q.row]![q.col] = { ...census }
      text += ` ${censusCode(census)} :`
    }
    lines.push(line('scan', text))
    lines.push(line('scan', rule))
  }

  return { patrol: { ...patrol, chart }, lines }
}

/** What the computer has been told, all sixty-four quadrants of it. */
export function galaxyChart(patrol: Patrol): Line[] {
  if (patrol.damage.computer > 0) {
    return [line('system', 'THE COMPUTER IS DOWN. THE CHART IS IN IT.')]
  }

  const lines = [
    line('scan', 'CHART OF THE GALAXY AS RECORDED'),
    line('scan', '     1    2    3    4    5    6    7    8'),
  ]
  for (let row = 0; row < GALAXY; row++) {
    let text = `${row + 1} `
    for (let col = 0; col < GALAXY; col++) text += ` ${censusCode(patrol.chart[row]![col]!)} `
    lines.push(line('scan', text))
  }
  lines.push(
    line('scan', `RAIDERS LEFT ${patrol.raidersLeft}   DAYS LEFT ${daysLeft(patrol).toFixed(1)}`),
  )
  return lines
}

export function damageReport(patrol: Patrol): Line[] {
  const broken = DEVICES.filter((d) => patrol.damage[d] > 0)
  if (broken.length === 0) return [line('damage', 'ALL SYSTEMS ANSWER.')]
  return [
    line('damage', 'DEVICE              DAYS TO REPAIR'),
    ...broken.map((d) =>
      line('damage', `${DEVICE_NAMES[d]!.padEnd(20)}${patrol.damage[d]!.toFixed(1)}`),
    ),
  ]
}

export const daysLeft = (patrol: Patrol) => Math.max(0, patrol.deadline - patrol.day)

// -------------------------------------------------------------------- fighting

/**
 * Everything still alive in this quadrant shoots back.
 *
 * A raider hits harder the closer it is and spends itself doing it, which is
 * the only reason a long fight is ever winnable: sit at range and you take
 * less and give less, close in and it is settled either way in two exchanges.
 */
function raidersFire(patrol: Patrol, rng: Rng, lines: Line[]): Patrol {
  if (patrol.raiders.length === 0) return patrol
  if (patrol.docked) {
    lines.push(line('hit', 'THE STARBASE TAKES THE FIRE FOR YOU.'))
    return patrol
  }

  let shields = patrol.shields
  const damage = { ...patrol.damage }
  const raiders = patrol.raiders.map((k) => ({ ...k }))

  for (const k of raiders) {
    const range = Math.max(1, distance(k.at, patrol.sector))
    const hit = Math.floor((k.energy / range) * (2 + rng()))
    shields -= hit
    k.energy /= 3 + rng()

    lines.push(
      line(
        'hit',
        `${hit} UNIT HIT FROM THE RAIDER AT ${say(k.at)}. SHIELDS AT ${Math.max(0, Math.round(shields))}.`,
      ),
    )

    if (shields <= 0) break

    if (rng() < DAMAGE_CHANCE) {
      const d = DEVICES[Math.floor(rng() * DEVICES.length)]!
      damage[d] += DAMAGE_DAYS * rng() + 1
      lines.push(line('damage', `${DEVICE_NAMES[d]} DAMAGED.`))
    }
  }

  const next = { ...patrol, shields: Math.max(0, shields), damage, raiders }
  if (shields <= 0) {
    lines.push(line('end', 'SHIELDS ARE GONE.'))
    return { ...next, outcome: 'destroyed' }
  }
  return next
}

/** Take a raider off the board, here and in the galaxy's own count. */
function killRaider(patrol: Patrol, at: Coord): Patrol {
  const galaxy = patrol.galaxy.map((r) => r.map((c) => ({ ...c })))
  const q = galaxy[patrol.quadrant.row]![patrol.quadrant.col]!
  q.raiders = Math.max(0, q.raiders - 1)

  const chart = patrol.chart.map((r) => r.slice())
  chart[patrol.quadrant.row]![patrol.quadrant.col] = { ...q }

  return {
    ...patrol,
    galaxy,
    chart,
    raiders: patrol.raiders.filter((k) => !same(k.at, at)),
    raidersLeft: Math.max(0, patrol.raidersLeft - 1),
    raidersKilled: patrol.raidersKilled + 1,
  }
}

function fireBeams(patrol: Patrol, amount: number, rng: Rng): { patrol: Patrol; lines: Line[] } {
  const lines: Line[] = []
  if (patrol.damage.beams > 0) return { patrol, lines: [line('system', 'BEAM CONTROL IS OUT.')] }
  if (patrol.raiders.length === 0) {
    return { patrol, lines: [line('system', 'NOTHING IN THIS QUADRANT TO SHOOT AT.')] }
  }

  const spend = clamp(Math.floor(amount), 0, Math.floor(patrol.energy))
  if (spend <= 0) return { patrol, lines: [line('system', 'NO ENERGY RELEASED.')] }

  let next: Patrol = { ...patrol, energy: patrol.energy - spend }
  lines.push(line('fire', `BEAMS FIRED. ${spend} UNITS RELEASED.`))

  // A blind shot is a worse shot. The computer is what spreads the energy
  // across the targets; without it you are pointing the ship and hoping.
  let effective = spend
  if (next.damage.computer > 0) {
    effective = spend * 0.6
    lines.push(line('system', 'WITHOUT THE COMPUTER THE SPREAD IS WIDE.'))
  }

  const share = effective / next.raiders.length
  // A snapshot: killRaider rewrites next.raiders underneath this loop.
  const targets = next.raiders.slice()
  for (const k of targets) {
    const range = Math.max(1, distance(k.at, next.sector))
    const hit = Math.floor((share * (2 + rng())) / range)

    if (hit <= k.energy * BEAM_FLOOR) {
      lines.push(line('fire', `THE RAIDER AT ${say(k.at)} SHRUGS IT OFF.`))
      continue
    }

    const left = k.energy - hit
    if (left <= 0) {
      lines.push(line('fire', `THE RAIDER AT ${say(k.at)} COMES APART.`))
      next = killRaider(next, k.at)
    } else {
      next = {
        ...next,
        raiders: next.raiders.map((r) => (same(r.at, k.at) ? { ...r, energy: left } : r)),
      }
      lines.push(line('fire', `${hit} UNITS ONTO THE RAIDER AT ${say(k.at)}.`))
    }
  }

  return { patrol: raidersFire(next, rng, lines), lines }
}

/**
 * One torpedo, one course, and no guidance at all: it goes where it is
 * pointed until it meets something. Meeting a star means the star wins, and
 * meeting the starbase means the patrol is over in the worst way there is.
 */
function fireTorpedo(patrol: Patrol, course: number, rng: Rng): { patrol: Patrol; lines: Line[] } {
  if (patrol.damage.tubes > 0) return { patrol, lines: [line('system', 'THE TUBES ARE OUT.')] }
  if (patrol.torpedoes <= 0) return { patrol, lines: [line('system', 'THE RACKS ARE EMPTY.')] }
  if (!(course >= 1 && course <= 9)) return { patrol, lines: [line('system', NO_SUCH_COURSE)] }

  const lines: Line[] = [line('fire', 'TORPEDO AWAY.')]
  let next: Patrol = { ...patrol, torpedoes: patrol.torpedoes - 1 }
  const step = heading(course)
  let at = { row: next.sector.row, col: next.sector.col }

  for (;;) {
    at = { row: at.row + step.row, col: at.col + step.col }
    const cell = round(at)
    if (cell.row < 0 || cell.row >= SECTORS || cell.col < 0 || cell.col >= SECTORS) {
      lines.push(line('fire', 'THE TORPEDO LEAVES THE QUADRANT AND KEEPS GOING.'))
      break
    }

    const who = occupant(next, cell)
    if (who === 'raider') {
      lines.push(line('fire', `DIRECT HIT. THE RAIDER AT ${say(cell)} IS GONE.`))
      next = killRaider(next, cell)
      break
    }
    if (who === 'star') {
      lines.push(line('fire', `THE STAR AT ${say(cell)} SWALLOWS IT.`))
      break
    }
    if (who === 'base') {
      lines.push(line('end', `THE STARBASE AT ${say(cell)} IS GONE.`))
      return { patrol: { ...next, outcome: 'base-destroyed' }, lines }
    }
  }

  return { patrol: raidersFire(next, rng, lines), lines }
}

// -------------------------------------------------------------------- moving

/**
 * Warp.
 *
 * The whole move happens in galaxy coordinates -- sixty-four sectors on a
 * side -- because a course does not stop at a quadrant boundary and neither
 * should the arithmetic. Blocking only applies inside the quadrant you can
 * actually see: the ship has no idea what is in the next one until it gets
 * there, which is exactly the bargain the game is offering.
 */
function navigate(
  patrol: Patrol,
  course: number,
  warp: number,
  rng: Rng,
): { patrol: Patrol; lines: Line[] } {
  if (!(course >= 1 && course <= 9)) return { patrol, lines: [line('system', NO_SUCH_COURSE)] }

  if (patrol.damage.warp > 0 && warp > CRIPPLED_WARP) {
    return {
      patrol,
      lines: [line('system', `WARP ENGINES ARE OUT. ${CRIPPLED_WARP} IS ALL THERE IS.`)],
    }
  }

  const w = clamp(warp, 0, MAX_WARP)
  const sectors = Math.round(w * SECTORS)
  if (sectors <= 0) return { patrol, lines: [line('system', 'ALL STOP.')] }

  const lines: Line[] = []
  const step = heading(course)
  const startQuadrant = patrol.quadrant
  let pos = {
    row: patrol.quadrant.row * SECTORS + patrol.sector.row,
    col: patrol.quadrant.col * SECTORS + patrol.sector.col,
  }

  for (let i = 0; i < sectors; i++) {
    const next = { row: pos.row + step.row, col: pos.col + step.col }
    const cell = round(next)

    if (cell.row < 0 || cell.row >= GALAXY * SECTORS || cell.col < 0 || cell.col >= GALAXY * SECTORS) {
      lines.push(line('move', EDGE_TEXT))
      break
    }

    const q = { row: Math.floor(cell.row / SECTORS), col: Math.floor(cell.col / SECTORS) }
    if (same(q, startQuadrant)) {
      const local = { row: cell.row % SECTORS, col: cell.col % SECTORS }
      if (occupant(patrol, local) !== null && !same(local, patrol.sector)) {
        lines.push(line('move', BLOCKED_TEXT))
        break
      }
    }

    pos = next
  }

  const cell = round(pos)
  const quadrant = { row: Math.floor(cell.row / SECTORS), col: Math.floor(cell.col / SECTORS) }
  const sector = { row: cell.row % SECTORS, col: cell.col % SECTORS }
  const moved = !same(quadrant, startQuadrant)

  const cost = sectors * WARP_COST_PER_SECTOR + WARP_COST_FIXED
  const days = w >= 1 ? 1 : Math.round(w * 10) / 10

  let next: Patrol = { ...patrol, quadrant, sector, energy: patrol.energy - cost }

  // Out of power is not out of options while there is anything in the
  // shields; the original let you cannibalise them and so does this.
  if (next.energy < 0) {
    const short = -next.energy
    next = { ...next, energy: 0, shields: next.shields - short }
    if (next.shields <= 0) {
      lines.push(line('end', 'THE LAST OF THE POWER GOES INTO THE ENGINES.'))
      return { patrol: { ...next, shields: 0, outcome: 'stranded' }, lines }
    }
    lines.push(line('system', 'SHIELD POWER DIVERTED TO THE ENGINES.'))
  }

  next = passDays(next, days, rng, lines)

  if (moved) {
    lines.push(line('move', `WARP ${w} TO QUADRANT ${say(quadrant)}, SECTOR ${say(sector)}.`))
    const arrived = arrive(next, rng)
    next = arrived.patrol
    lines.push(...arrived.lines)
  } else {
    lines.push(line('move', `SECTOR ${say(sector)}.`))
    next = redock(next, lines)
  }

  if (next.outcome) return { patrol: next, lines }
  return { patrol: raidersFire(next, rng, lines), lines }
}

/**
 * Time passing, which is the only thing that repairs anything.
 *
 * Damage control works while the ship flies; it does not work while you sit
 * still thinking, because sitting still costs no days. That is why a badly
 * hurt ship has to keep moving, and why the temptation to limp to a starbase
 * at warp 0.2 is a real decision rather than a formality.
 */
function passDays(patrol: Patrol, days: number, rng: Rng, lines: Line[]): Patrol {
  const damage = { ...patrol.damage }
  for (const d of DEVICES) {
    if (damage[d] <= 0) continue
    damage[d] = Math.max(0, damage[d] - days)
    if (damage[d] === 0) lines.push(line('damage', `${DEVICE_NAMES[d]} BACK ON LINE.`))
  }

  // Damage control occasionally finds something, or breaks something.
  if (patrol.damage.repair === 0 && rng() < 0.1) {
    const d = DEVICES[Math.floor(rng() * DEVICES.length)]!
    if (damage[d] > 0) {
      damage[d] = 0
      lines.push(line('damage', `DAMAGE CONTROL HAS ${DEVICE_NAMES[d]} WORKING AGAIN.`))
    }
  }

  return { ...patrol, day: patrol.day + days, damage }
}

function setShields(patrol: Patrol, amount: number): { patrol: Patrol; lines: Line[] } {
  if (patrol.damage.shields > 0) return { patrol, lines: [line('system', SHIELDS_DOWN_TEXT)] }

  const pool = patrol.energy + patrol.shields
  const shields = clamp(Math.floor(amount), 0, Math.floor(pool))
  return {
    patrol: { ...patrol, shields, energy: pool - shields },
    lines: [line('system', `SHIELDS AT ${shields}. ENERGY AT ${Math.round(pool - shields)}.`)],
  }
}

// ---------------------------------------------------------------------- turn

/** Whatever the patrol has run out of, said once and only once. */
function settle(patrol: Patrol, lines: Line[]): Patrol {
  if (patrol.outcome) return patrol

  if (patrol.raidersLeft <= 0) {
    lines.push(line('win', 'THE LAST OF THEM IS OFF THE BOARD.'))
    return { ...patrol, outcome: 'mission-complete' }
  }
  if (patrol.day >= patrol.deadline) {
    lines.push(line('end', 'THE ORDERS EXPIRE.'))
    return { ...patrol, outcome: 'out-of-time' }
  }
  if (patrol.energy <= 0 && patrol.shields <= 0) {
    lines.push(line('end', 'EVERY LAST UNIT IS SPENT.'))
    return { ...patrol, outcome: 'stranded' }
  }
  return patrol
}

/** One command, and everything it sets off. The only way the patrol changes. */
export function step(patrol: Patrol, cmd: Command, rng: Rng): { patrol: Patrol; lines: Line[] } {
  if (patrol.outcome) return { patrol, lines: [] }

  let out: { patrol: Patrol; lines: Line[] }
  switch (cmd.type) {
    case 'nav':
      out = navigate(patrol, cmd.course, cmd.warp, rng)
      break
    case 'srs':
      out = { patrol, lines: shortRangeScan(patrol) }
      break
    case 'lrs':
      out = longRangeScan(patrol)
      break
    case 'beams':
      out = fireBeams(patrol, cmd.energy, rng)
      break
    case 'torpedo':
      out = fireTorpedo(patrol, cmd.course, rng)
      break
    case 'shields':
      out = setShields(patrol, cmd.energy)
      break
    case 'damage':
      out = { patrol, lines: damageReport(patrol) }
      break
    case 'chart':
      out = { patrol, lines: galaxyChart(patrol) }
      break
    case 'resign':
      out = { patrol: { ...patrol, outcome: 'resigned' }, lines: [] }
      break
  }

  const lines = [...out.lines]
  return { patrol: settle(out.patrol, lines), lines }
}

/** What to print when a patrol ends. The words are in constants.ts. */
export const outcomeText = (o: Outcome): string => OUTCOME_TEXT[o] ?? ''

/**
 * The standings, and the same order the shared board ranks in: raiders
 * destroyed first, then days you did not need, then torpedoes you did not
 * fire. Two captains who cleared the galaxy are separated by how fast, and
 * then by how tidily.
 */
export const comparePatrols = (a: Captain, b: Captain): number =>
  b.killed - a.killed || b.daysLeft - a.daysLeft || b.torpedoes - a.torpedoes
