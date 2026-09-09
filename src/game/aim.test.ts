import { describe, expect, it } from 'vitest'
import { SECTORS } from './constants'
import { courseTo, landing, navFor, stepsFor } from './aim'
import { heading } from './galaxy'

/**
 * Clicking a sector has to arrive at that sector, or the remaster is a
 * different game from the one on paper rather than the same one with the
 * lamp on. This is the test that says so.
 */

describe('reading a course off a direction', () => {
  it('recovers the eight spokes exactly', () => {
    const spokes: [number, number, number][] = [
      [0, 1, 1], // east, along the row
      [-1, 1, 2],
      [-1, 0, 3], // north
      [-1, -1, 4],
      [0, -1, 5],
      [1, -1, 6],
      [1, 0, 7], // south
      [1, 1, 8],
    ]
    for (const [row, col, course] of spokes) {
      expect(courseTo({ row, col }), `${row},${col}`).toBe(course)
    }
  })

  it('counts steps along the heading, not as the crow flies', () => {
    // Three diagonal steps is three, even though it covers 4.24 sectors.
    expect(stepsFor({ row: 3, col: 3 }, 8)).toBe(3)
    expect(stepsFor({ row: 0, col: 5 }, 1)).toBe(5)
  })
})

describe('clicking a sector', () => {
  /**
   * The whole grid against itself: 4032 ordered pairs of distinct sectors,
   * every one of them turned into a course and a warp and then flown by the
   * same arithmetic the engine uses.
   */
  it('lands on the sector that was clicked, from anywhere to anywhere', () => {
    const misses: string[] = []

    for (let fr = 0; fr < SECTORS; fr++) {
      for (let fc = 0; fc < SECTORS; fc++) {
        for (let tr = 0; tr < SECTORS; tr++) {
          for (let tc = 0; tc < SECTORS; tc++) {
            if (fr === tr && fc === tc) continue
            const from = { row: fr, col: fc }
            const d = { row: tr - fr, col: tc - fc }
            const { course, warp } = navFor(d)
            const at = landing(from, course, warp)
            if (at.row !== tr || at.col !== tc) {
              misses.push(`${fr},${fc} -> ${tr},${tc} landed ${at.row},${at.col}`)
            }
          }
        }
      }
    }

    expect(misses).toEqual([])
  })

  it('asks for a course and a warp a player could have typed', () => {
    const { course, warp } = navFor({ row: -2, col: 5 })
    expect(course).toBeGreaterThanOrEqual(1)
    expect(course).toBeLessThan(9)
    // One decimal place, which is what both prompts accept.
    expect(course * 10).toBeCloseTo(Math.round(course * 10))
    expect(warp * 10).toBeCloseTo(Math.round(warp * 10))
  })
})

describe('clicking a quadrant', () => {
  it('crosses whole quadrants and keeps the sector you were in', () => {
    // Two quadrants east is sixteen sectors east, and lands in the same
    // sector of the new one.
    const d = { row: 0, col: 2 * SECTORS }
    const { course, warp } = navFor(d)
    expect(course).toBe(1)
    expect(warp).toBe(2)
    expect(heading(course)).toEqual({ row: 0, col: 1 })
  })
})
