import {
  BASE_ODDS,
  GALAXY,
  MAX_STARS,
  RAIDER_ENERGY,
  RAIDER_ENERGY_SPREAD,
  RAIDER_ODDS,
  SECTORS,
} from './constants'
import type { Rng } from './rng'
import type { Census, Coord, Patrol, Raider } from './types'

/**
 * The compass, and the one piece of this game most people misremember.
 *
 * Courses run 1 to 9 anticlockwise with 1 pointing along the row -- east, if
 * you are looking at the printed grid -- and 9 is 1 again, so that a course of
 * 8.5 has somewhere to go. A course is not an angle in degrees and never was:
 * the whole point is that you can hold the nine of them in your head while
 * reading a scan, and steer by counting round.
 *
 * Rows increase downward, because the grid is printed rather than plotted.
 */
const COMPASS: readonly Coord[] = [
  { row: 0, col: 1 }, // 1  east
  { row: -1, col: 1 }, // 2
  { row: -1, col: 0 }, // 3  north
  { row: -1, col: -1 }, // 4
  { row: 0, col: -1 }, // 5  west
  { row: 1, col: -1 }, // 6
  { row: 1, col: 0 }, // 7  south
  { row: 1, col: 1 }, // 8
  { row: 0, col: 1 }, // 9  east again
]

/** The unit step for a course, interpolating between the nine spokes. */
export function heading(course: number): Coord {
  const i = Math.min(Math.floor(course), 8)
  const f = course - i
  const a = COMPASS[i - 1]!
  const b = COMPASS[i]!
  return { row: a.row + (b.row - a.row) * f, col: a.col + (b.col - a.col) * f }
}

export const inGalaxy = (c: Coord) =>
  c.row >= 0 && c.row < GALAXY && c.col >= 0 && c.col < GALAXY

export const inQuadrant = (c: Coord) =>
  c.row >= 0 && c.row < SECTORS && c.col >= 0 && c.col < SECTORS

export const same = (a: Coord, b: Coord) => a.row === b.row && a.col === b.col

export const distance = (a: Coord, b: Coord) =>
  Math.sqrt((a.row - b.row) ** 2 + (a.col - b.col) ** 2)

/** Two sectors touching, corners included. What docking means. */
export const adjacent = (a: Coord, b: Coord) =>
  !same(a, b) && Math.abs(a.row - b.row) <= 1 && Math.abs(a.col - b.col) <= 1

const pick = (rng: Rng, n: number) => Math.floor(rng() * n)

export const randomCoord = (rng: Rng, n = SECTORS): Coord => ({
  row: pick(rng, n),
  col: pick(rng, n),
})

function censusFor(rng: Rng): Census {
  const roll = rng()
  let raiders = 0
  for (const [over, n] of RAIDER_ODDS) {
    if (roll > over) {
      raiders = n
      break
    }
  }
  return { raiders, base: rng() > BASE_ODDS, stars: 1 + pick(rng, MAX_STARS) }
}

/**
 * Scatter the galaxy.
 *
 * Two fix-ups afterwards, both of which the original also needed: a galaxy
 * with no raiders in it is not a patrol, and a galaxy with no starbase in it
 * is not survivable. Rolling until the scatter happens to be playable would
 * bias every other quadrant; placing the missing one is honest about what it
 * is.
 */
export function makeGalaxy(rng: Rng): { galaxy: Census[][]; raiders: number; bases: number } {
  const galaxy: Census[][] = []
  for (let row = 0; row < GALAXY; row++) {
    const line: Census[] = []
    for (let col = 0; col < GALAXY; col++) line.push(censusFor(rng))
    galaxy.push(line)
  }

  let raiders = galaxy.flat().reduce((n, q) => n + q.raiders, 0)
  let bases = galaxy.flat().filter((q) => q.base).length

  if (raiders === 0) {
    const c = randomCoord(rng, GALAXY)
    galaxy[c.row]![c.col]!.raiders = 1
    raiders = 1
  }
  if (bases === 0) {
    const c = randomCoord(rng, GALAXY)
    galaxy[c.row]![c.col]!.base = true
    bases = 1
  }

  return { galaxy, raiders, bases }
}

/** A three-digit quadrant code: raiders, starbases, stars. Unscanned is stars. */
export const censusCode = (c: Census | null): string =>
  c === null ? '***' : `${Math.min(c.raiders, 9)}${c.base ? 1 : 0}${Math.min(c.stars, 9)}`

/**
 * Lay out the quadrant the ship has just arrived in.
 *
 * The census says how many of each; where they go is decided now and
 * forgotten on the way out. That is the original's behaviour and it is worth
 * keeping rather than tidying: a quadrant is a fight, not a place, and the
 * only thing that persists about it is the count on the chart.
 */
export function layQuadrant(patrol: Patrol, rng: Rng): Patrol {
  const census = patrol.galaxy[patrol.quadrant.row]![patrol.quadrant.col]!
  const taken: Coord[] = [patrol.sector]

  const free = (): Coord => {
    for (;;) {
      const c = randomCoord(rng)
      if (!taken.some((t) => same(t, c))) {
        taken.push(c)
        return c
      }
    }
  }

  const raiders: Raider[] = []
  for (let i = 0; i < census.raiders; i++) {
    raiders.push({ at: free(), energy: RAIDER_ENERGY + rng() * RAIDER_ENERGY_SPREAD })
  }
  const base = census.base ? free() : null
  const stars: Coord[] = []
  for (let i = 0; i < census.stars; i++) stars.push(free())

  return { ...patrol, raiders, base, stars }
}

/** What is standing in a sector, if anything. */
export type Occupant = 'ship' | 'raider' | 'base' | 'star' | null

export function occupant(patrol: Patrol, at: Coord): Occupant {
  if (same(at, patrol.sector)) return 'ship'
  if (patrol.raiders.some((k) => same(k.at, at))) return 'raider'
  if (patrol.base && same(patrol.base, at)) return 'base'
  if (patrol.stars.some((s) => same(s, at))) return 'star'
  return null
}
