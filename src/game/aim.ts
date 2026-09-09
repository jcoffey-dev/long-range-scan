import { SECTORS } from './constants'
import { heading } from './galaxy'
import type { Coord } from './types'

/**
 * Pointing, translated into steering.
 *
 * The remaster lets you click where you want to go, and the engine takes a
 * course from 1 to 9 and a warp factor. Nothing here is a second way to play
 * the game -- it is a way to type. Everything below produces a course and a
 * warp a player could have entered themselves, at the same one-decimal
 * precision the prompt accepts, and the log prints them as though they had.
 *
 * The course is found by search rather than by algebra, and deliberately.
 * `heading()` is piecewise linear between the eight spokes, so its magnitude
 * is not constant -- it runs from 1 on the axes to root two on the diagonals
 * -- and inverting that in closed form is a page of case analysis that would
 * be wrong in one of the octants. Eighty-one candidates at a tenth apiece is
 * the whole search space of things a player could type, so trying all of them
 * is both simpler and exact where it matters.
 */

const DEG = 180 / Math.PI

/** The course whose heading points most nearly along `d`. */
export function courseTo(d: Coord): number {
  const want = Math.atan2(d.row, d.col)
  let best = 1
  let bestErr = Infinity

  for (let c = 10; c < 90; c++) {
    const course = c / 10
    const h = heading(course)
    // Angular distance, wrapped, so 359 degrees away counts as one.
    const err = Math.abs(((Math.atan2(h.row, h.col) - want) * DEG + 540) % 360) - 180
    if (Math.abs(err) < bestErr) {
      bestErr = Math.abs(err)
      best = course
    }
  }
  return best
}

/**
 * How many sectors to travel on that course to arrive at `d`.
 *
 * Measured along the heading rather than as a straight-line distance,
 * because a diagonal step covers root two sectors and the engine counts
 * steps, not distance.
 */
export function stepsFor(d: Coord, course: number): number {
  const h = heading(course)
  const len = Math.hypot(h.row, h.col)
  return Math.max(1, Math.round(Math.hypot(d.row, d.col) / len))
}

/** A whole answer to both prompts, for a move of `d` sectors. */
export function navFor(d: Coord): { course: number; warp: number } {
  const course = courseTo(d)
  const steps = stepsFor(d, course)
  // Warp is sectors over eight, at the tenth the prompt accepts.
  return { course, warp: Math.round((steps / SECTORS) * 10) / 10 }
}

/** Where a warp on this course actually ends up, by the engine's own rules. */
export function landing(from: Coord, course: number, warp: number): Coord {
  const h = heading(course)
  const steps = Math.round(warp * SECTORS)
  return {
    row: Math.round(from.row + h.row * steps),
    col: Math.round(from.col + h.col * steps),
  }
}
