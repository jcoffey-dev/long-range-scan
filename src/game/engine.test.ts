import { describe, expect, it } from 'vitest'
import { GALAXY, GLYPH, SECTORS, START_ENERGY, START_TORPEDOES } from './constants'
import { makePatrol, shortRangeScan, step } from './engine'
import { makeRng } from './rng'
import { DEVICES, type Census, type DeviceId, type Patrol } from './types'

const rng = () => makeRng(4242)

const emptyGalaxy = (): Census[][] =>
  Array.from({ length: GALAXY }, () =>
    Array.from({ length: GALAXY }, () => ({ raiders: 0, base: false, stars: 0 })),
  )

/**
 * A patrol with nothing in it, to be furnished a piece at a time. Building
 * one by hand rather than dealing one is the only way to test a rule instead
 * of testing the dice.
 */
function bare(over: Partial<Patrol> = {}): Patrol {
  const galaxy = emptyGalaxy()
  return {
    day: 2000,
    deadline: 2030,
    galaxy,
    chart: Array.from({ length: GALAXY }, () => Array.from({ length: GALAXY }, () => null)),
    quadrant: { row: 0, col: 0 },
    sector: { row: 0, col: 0 },
    energy: START_ENERGY,
    shields: 500,
    torpedoes: START_TORPEDOES,
    damage: Object.fromEntries(DEVICES.map((d) => [d, 0])) as Record<DeviceId, number>,
    raiders: [],
    stars: [],
    base: null,
    docked: false,
    raidersLeft: 5,
    raidersKilled: 0,
    basesLeft: 1,
    outcome: null,
    ...over,
  }
}

describe('a dealt patrol', () => {
  it('agrees with its own galaxy about how many raiders there are', () => {
    for (const seed of [1, 2, 3, 99, 12345]) {
      const p = makePatrol(makeRng(seed))
      const actual = p.galaxy.flat().reduce((n, q) => n + q.raiders, 0)
      expect(p.raidersLeft).toBe(actual)
      expect(p.raidersKilled).toBe(0)
      expect(p.outcome).toBeNull()
    }
  })

  it('charts the quadrant it starts in, and nothing else', () => {
    const p = makePatrol(makeRng(5))
    const charted = p.chart.flat().filter((c) => c !== null)
    expect(charted).toHaveLength(1)
    expect(p.chart[p.quadrant.row]![p.quadrant.col]).not.toBeNull()
  })
})

describe('the short range scan', () => {
  it('prints eight rows between two rules, with the ship on one of them', () => {
    const p = bare({ sector: { row: 2, col: 3 } })
    const lines = shortRangeScan(p)
    expect(lines).toHaveLength(SECTORS + 2)
    expect(lines[3]!.text).toContain(GLYPH.ship)
  })

  it('refuses when the sensors are out, rather than guessing', () => {
    const damage = { ...bare().damage, srs: 3 }
    const lines = shortRangeScan(bare({ damage }))
    expect(lines).toHaveLength(1)
    expect(lines[0]!.text).toContain('SENSORS ARE OUT')
  })
})

describe('warp', () => {
  it('crosses eight sectors for every whole warp factor', () => {
    const { patrol } = step(bare(), { type: 'nav', course: 1, warp: 1 }, rng())
    // Eight sectors east from 1,1 is the first sector of the next quadrant.
    expect(patrol.quadrant).toEqual({ row: 0, col: 1 })
    expect(patrol.sector).toEqual({ row: 0, col: 0 })
  })

  it('stops at the rim rather than falling off it', () => {
    const { patrol, lines } = step(bare(), { type: 'nav', course: 5, warp: 2 }, rng())
    expect(patrol.quadrant).toEqual({ row: 0, col: 0 })
    expect(patrol.sector).toEqual({ row: 0, col: 0 })
    expect(lines.some((l) => l.text.includes('GALAXY ENDS'))).toBe(true)
  })

  it('stops short of anything in the way', () => {
    const p = bare({ stars: [{ row: 0, col: 2 }] })
    const { patrol, lines } = step(p, { type: 'nav', course: 1, warp: 0.25 }, rng())
    expect(patrol.sector).toEqual({ row: 0, col: 1 })
    expect(lines.some((l) => l.text.includes('IN THE WAY'))).toBe(true)
  })

  it('refuses more than a crawl when the engines are out', () => {
    const damage = { ...bare().damage, warp: 4 }
    const p = bare({ damage })
    const { patrol, lines } = step(p, { type: 'nav', course: 1, warp: 3 }, rng())
    expect(patrol.sector).toEqual(p.sector)
    expect(lines[0]!.text).toContain('WARP ENGINES ARE OUT')
  })

  it('spends a day, and a day is what repairs things', () => {
    const damage = { ...bare().damage, lrs: 0.5 }
    const { patrol } = step(bare({ damage }), { type: 'nav', course: 7, warp: 1 }, rng())
    expect(patrol.day).toBe(2001)
    expect(patrol.damage.lrs).toBe(0)
  })
})

describe('mooring', () => {
  it('fills the tanks and the racks when you pull up beside a starbase', () => {
    const p = bare({ base: { row: 0, col: 3 }, energy: 40, torpedoes: 1, shields: 300 })
    const { patrol } = step(p, { type: 'nav', course: 1, warp: 0.25 }, rng())
    expect(patrol.docked).toBe(true)
    expect(patrol.energy).toBe(START_ENERGY)
    expect(patrol.torpedoes).toBe(START_TORPEDOES)
    expect(patrol.shields).toBe(0)
  })
})

describe('torpedoes', () => {
  it('take a raider off the board and off the count', () => {
    const p = bare({
      raidersLeft: 1,
      raiders: [{ at: { row: 0, col: 4 }, energy: 300 }],
      galaxy: (() => {
        const g = emptyGalaxy()
        g[0]![0] = { raiders: 1, base: false, stars: 0 }
        return g
      })(),
    })
    const { patrol } = step(p, { type: 'torpedo', course: 1 }, rng())
    expect(patrol.raiders).toHaveLength(0)
    expect(patrol.raidersKilled).toBe(1)
    expect(patrol.raidersLeft).toBe(0)
    expect(patrol.torpedoes).toBe(START_TORPEDOES - 1)
    // Nothing left anywhere is the end of it.
    expect(patrol.outcome).toBe('mission-complete')
  })

  it('are swallowed by a star, and the star is still there', () => {
    const p = bare({ stars: [{ row: 0, col: 3 }] })
    const { patrol, lines } = step(p, { type: 'torpedo', course: 1 }, rng())
    expect(lines.some((l) => l.text.includes('SWALLOWS'))).toBe(true)
    expect(patrol.stars).toHaveLength(1)
    expect(patrol.outcome).toBeNull()
  })

  it('end the patrol if they take the starbase', () => {
    const p = bare({ base: { row: 0, col: 5 } })
    const { patrol } = step(p, { type: 'torpedo', course: 1 }, rng())
    expect(patrol.outcome).toBe('base-destroyed')
  })

  it('are refused when the racks are empty, at no cost', () => {
    const p = bare({ torpedoes: 0 })
    const { patrol, lines } = step(p, { type: 'torpedo', course: 1 }, rng())
    expect(patrol.torpedoes).toBe(0)
    expect(lines[0]!.text).toContain('RACKS ARE EMPTY')
  })
})

describe('being shot at', () => {
  it('ends the patrol when the shields are gone', () => {
    const p = bare({
      shields: 1,
      raiders: [{ at: { row: 0, col: 1 }, energy: 400 }],
    })
    const { patrol } = step(p, { type: 'beams', energy: 1 }, rng())
    expect(patrol.outcome).toBe('destroyed')
  })

  it('does not happen at all while moored', () => {
    const p = bare({
      base: { row: 0, col: 1 },
      docked: true,
      shields: 1,
      raiders: [{ at: { row: 0, col: 2 }, energy: 400 }],
    })
    const { patrol, lines } = step(p, { type: 'beams', energy: 1 }, rng())
    expect(patrol.outcome).toBeNull()
    expect(lines.some((l) => l.text.includes('STARBASE TAKES THE FIRE'))).toBe(true)
  })
})

describe('the clock', () => {
  it('ends the patrol when the orders expire', () => {
    const p = bare({ day: 2029.5, deadline: 2030 })
    const { patrol } = step(p, { type: 'nav', course: 7, warp: 1 }, rng())
    expect(patrol.outcome).toBe('out-of-time')
  })
})

describe('running dry', () => {
  it('takes the last of it out of the shields before giving up', () => {
    const p = bare({ energy: 5, shields: 400 })
    const { patrol } = step(p, { type: 'nav', course: 7, warp: 1 }, rng())
    expect(patrol.energy).toBe(0)
    expect(patrol.shields).toBeLessThan(400)
    expect(patrol.outcome).toBeNull()
  })

  it('strands you when there is nothing left in either', () => {
    const p = bare({ energy: 5, shields: 2 })
    const { patrol } = step(p, { type: 'nav', course: 7, warp: 1 }, rng())
    expect(patrol.outcome).toBe('stranded')
  })
})

describe('a finished patrol', () => {
  it('takes no further commands', () => {
    const p = bare({ outcome: 'resigned' })
    const { patrol, lines } = step(p, { type: 'nav', course: 1, warp: 4 }, rng())
    expect(patrol).toBe(p)
    expect(lines).toHaveLength(0)
  })
})
