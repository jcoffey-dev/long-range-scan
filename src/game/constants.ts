/**
 * The numbers, all of them, in one place.
 *
 * The 1971 game is arithmetic where Hunt the Wumpus is arrangement: almost
 * everything here is a constant somebody typed into a BASIC listing, and the
 * feel of the game is those constants rather than any one rule. They are
 * reconstructed from the published behaviour of the 1978 type-in -- how much
 * a warp costs, how hard a raider hits at range, how long a repair takes --
 * and the places where a judgement call was needed are marked.
 */

/** Quadrants across the galaxy, and sectors across a quadrant. Both 8. */
export const GALAXY = 8
export const SECTORS = 8

export const START_ENERGY = 3000
export const START_TORPEDOES = 10

/** A patrol is short. That is the whole tension: the clock, not the shooting. */
export const MIN_DAYS = 25
export const MAX_EXTRA_DAYS = 10

/**
 * How thickly raiders are scattered, quadrant by quadrant. A roll over 0.98
 * puts three in one quadrant, which is very nearly a death sentence to warp
 * into and is meant to be.
 */
export const RAIDER_ODDS: readonly (readonly [number, number])[] = [
  [0.98, 3],
  [0.95, 2],
  [0.8, 1],
]

/** A starbase is rare. Most quadrants have nowhere to refit. */
export const BASE_ODDS = 0.96

/** Stars per quadrant: one to eight, and they block everything. */
export const MAX_STARS = 8

export const RAIDER_ENERGY = 200
/** Spread, so two raiders are never quite the same fight. */
export const RAIDER_ENERGY_SPREAD = 200

/**
 * What a warp costs: one unit per sector crossed, plus ten to light the
 * engines. That looks far too cheap until you notice where energy actually
 * goes -- into the beams and into the shields. Crossing the galaxy is not the
 * expensive thing. Arriving somewhere with raiders in it is.
 */
export const WARP_COST_PER_SECTOR = 1
export const WARP_COST_FIXED = 10

/** Warp engines out means you crawl: two-tenths, and no further. */
export const CRIPPLED_WARP = 0.2
export const MAX_WARP = 8

/** Below this, a beam does not get through the raider's own shields. */
export const BEAM_FLOOR = 0.15

/** Days of repair a hit costs a device, before the roll that softens it. */
export const DAMAGE_DAYS = 6
export const DAMAGE_CHANCE = 0.2

/** Docking repairs everything, in a hurry rather than instantly. */
export const DOCK_REPAIR_DAYS = 1

/** A yellow board: running out of power a long way from anywhere. */
export const LOW_ENERGY = 0.1

export const MAX_CAPTAINS = 4
export const MAX_NAME = 12

/*
 * Everything the machine says, and none of it is anybody else's.
 *
 * The 1971 game and the 1978 type-in that carried it have famous lines in
 * them, and those sentences belong to the people who wrote them. A project
 * released under a copyleft licence cannot go around licensing words it did
 * not write, so every line below was written for this project. See NOTICE.md,
 * which is the same argument the two sibling games make.
 *
 * They are shouted because the machine had no lower case, not because we are
 * shouting.
 */

export const HAIL_TEXT = [
  'FLEET COMMAND TO PATROL VESSEL',
  'RAIDERS ARE LOOSE IN ALL EIGHT BY EIGHT QUADRANTS.',
  'FIND THEM AND END THEM BEFORE YOUR TIME RUNS OUT.',
]

export const CONDITION_TEXT: Record<string, string> = {
  DOCKED: 'DOCKED',
  RED: 'RED',
  YELLOW: 'YELLOW',
  GREEN: 'GREEN',
}

export const OUTCOME_TEXT: Record<string, string> = {
  'mission-complete': 'THE LAST RAIDER IS GONE. THE QUADRANTS ARE QUIET.',
  'out-of-time': 'THE CLOCK RUNS OUT. WHAT IS LEFT OUT THERE STAYS OUT THERE.',
  destroyed: 'THE HULL OPENS. NOTHING FURTHER IS RECEIVED FROM YOU.',
  stranded: 'NO POWER, NO SHIELDS, NO WAY HOME. YOU DRIFT.',
  resigned: 'YOU BREAK OFF AND TURN FOR HOME.',
  'base-destroyed': 'YOUR OWN TORPEDO TAKES THE STARBASE. FLEET COMMAND RELIEVES YOU.',
}

/** The eight things that can be broken, in the order the report lists them. */
export const DEVICE_NAMES: Record<string, string> = {
  warp: 'WARP ENGINES',
  srs: 'SHORT RANGE SENSORS',
  lrs: 'LONG RANGE SENSORS',
  beams: 'BEAM CONTROL',
  tubes: 'TORPEDO TUBES',
  repair: 'DAMAGE CONTROL',
  shields: 'SHIELD CONTROL',
  computer: 'COMPUTER',
}

/** What a sector looks like on paper. Three columns each, so the grid squares up. */
export const GLYPH = {
  ship: '<O>',
  raider: '+R+',
  base: '>!<',
  star: ' * ',
  empty: '   ',
} as const

export const NO_SUCH_COURSE = 'COURSE MUST BE 1 THROUGH 9'
export const BLOCKED_TEXT = 'SOMETHING IS IN THE WAY. ALL STOP.'
export const EDGE_TEXT = 'THE GALAXY ENDS HERE. ALL STOP AT THE RIM.'
export const DOCKED_TEXT = 'MOORED TO THE STARBASE. TANKS FULL, TUBES FULL, SHIELDS DOWN.'
export const SHIELDS_DOWN_TEXT = 'SHIELD CONTROL IS OUT. NOTHING TO PUT IT IN.'
