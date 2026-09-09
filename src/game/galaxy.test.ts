import { describe, expect, it } from 'vitest'
import { GALAXY, RAIDER_ODDS, SECTORS } from './constants'
import { adjacent, censusCode, heading, layQuadrant, makeGalaxy, same } from './galaxy'
import { makeRng } from './rng'
import type { Census, Patrol } from './types'

/**
 * The galaxy is arithmetic, so it can be checked rather than trusted. These
 * are the facts the rest of the game leans on without ever re-testing them.
 */

describe('the compass', () => {
  it('puts the four cardinals where the printed grid wants them', () => {
    expect(heading(1)).toEqual({ row: 0, col: 1 }) // east, along the row
    expect(heading(3)).toEqual({ row: -1, col: 0 }) // north, up the page
    expect(heading(5)).toEqual({ row: 0, col: -1 })
    expect(heading(7)).toEqual({ row: 1, col: 0 })
  })

  it('closes the circle, so 9 is 1 again', () => {
    expect(heading(9)).toEqual(heading(1))
  })

  it('interpolates between the spokes', () => {
    // Halfway from east to north-east is half a row up and a whole column on.
    expect(heading(1.5)).toEqual({ row: -0.5, col: 1 })
  })
})

describe('a scattered galaxy', () => {
  it('is always worth flying: at least one raider and one base', () => {
    // The scatter is thin enough that an empty galaxy is not a freak event,
    // which is exactly why the fix-ups exist.
    for (let seed = 1; seed <= 200; seed++) {
      const { galaxy, raiders, bases } = makeGalaxy(makeRng(seed))
      expect(raiders).toBeGreaterThan(0)
      expect(bases).toBeGreaterThan(0)
      expect(galaxy.flat().reduce((n, q) => n + q.raiders, 0)).toBe(raiders)
      expect(galaxy.flat().filter((q) => q.base).length).toBe(bases)
    }
  })

  it('is eight by eight, and every quadrant has at least one star', () => {
    const { galaxy } = makeGalaxy(makeRng(7))
    expect(galaxy).toHaveLength(GALAXY)
    for (const row of galaxy) {
      expect(row).toHaveLength(GALAXY)
      for (const q of row) {
        expect(q.stars).toBeGreaterThan(0)
        expect(q.raiders).toBeLessThanOrEqual(RAIDER_ODDS[0]![1])
      }
    }
  })
})

describe('the three-digit code', () => {
  it('reads raiders, starbases, stars, in that order', () => {
    expect(censusCode({ raiders: 2, base: false, stars: 5 })).toBe('205')
    expect(censusCode({ raiders: 0, base: true, stars: 1 })).toBe('011')
  })

  it('says nothing at all about a quadrant nobody has scanned', () => {
    expect(censusCode(null)).toBe('***')
  })
})

const emptyGalaxy = (): Census[][] =>
  Array.from({ length: GALAXY }, () =>
    Array.from({ length: GALAXY }, () => ({ raiders: 0, base: false, stars: 0 })),
  )

describe('laying out a quadrant', () => {
  it('puts down exactly what the census says, and never on top of anything', () => {
    const galaxy = emptyGalaxy()
    galaxy[0]![0] = { raiders: 3, base: true, stars: 8 }

    const patrol = {
      galaxy,
      quadrant: { row: 0, col: 0 },
      sector: { row: 4, col: 4 },
      raiders: [],
      stars: [],
      base: null,
    } as unknown as Patrol

    const laid = layQuadrant(patrol, makeRng(11))
    expect(laid.raiders).toHaveLength(3)
    expect(laid.stars).toHaveLength(8)
    expect(laid.base).not.toBeNull()

    const all = [...laid.raiders.map((r) => r.at), ...laid.stars, laid.base!, laid.sector]
    for (const a of all) {
      expect(a.row).toBeGreaterThanOrEqual(0)
      expect(a.row).toBeLessThan(SECTORS)
      expect(all.filter((b) => same(a, b))).toHaveLength(1)
    }
  })
})

describe('mooring', () => {
  it('counts the corners, and does not count standing on it', () => {
    expect(adjacent({ row: 3, col: 3 }, { row: 2, col: 2 })).toBe(true)
    expect(adjacent({ row: 3, col: 3 }, { row: 3, col: 5 })).toBe(false)
    expect(adjacent({ row: 3, col: 3 }, { row: 3, col: 3 })).toBe(false)
  })
})
