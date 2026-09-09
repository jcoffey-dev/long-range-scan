/** A position, zero-based. Everything the machine prints adds one. */
export interface Coord {
  row: number
  col: number
}

export type DeviceId =
  | 'warp'
  | 'srs'
  | 'lrs'
  | 'beams'
  | 'tubes'
  | 'repair'
  | 'shields'
  | 'computer'

export const DEVICES: readonly DeviceId[] = [
  'warp',
  'srs',
  'lrs',
  'beams',
  'tubes',
  'repair',
  'shields',
  'computer',
]

/**
 * What a quadrant holds, without saying where in it. This is the galaxy's
 * whole memory: the sectors are laid out fresh each time you arrive, exactly
 * as the original did, which is why leaving and coming back rearranges the
 * furniture but never changes the count.
 */
export interface Census {
  raiders: number
  base: boolean
  stars: number
}

export interface Raider {
  at: Coord
  /** Spent by taking hits and by shooting from a long way off. */
  energy: number
}

export type Condition = 'DOCKED' | 'RED' | 'YELLOW' | 'GREEN'

export type Outcome =
  | 'mission-complete'
  | 'out-of-time'
  | 'destroyed'
  | 'stranded'
  | 'resigned'
  | 'base-destroyed'

/** True when the patrol ended in a way the captain walks away from. */
export const isWin = (o: Outcome | null): boolean => o === 'mission-complete'

/** One captain's whole patrol. The only mutable thing in the game. */
export interface Patrol {
  /** Today, in the fleet's own numbering. Counts up. */
  day: number
  /** The day the orders expire. */
  deadline: number

  /** The truth, all sixty-four quadrants of it. */
  galaxy: Census[][]
  /** What has actually been scanned. A quadrant never seen is null. */
  chart: (Census | null)[][]

  quadrant: Coord
  sector: Coord

  energy: number
  shields: number
  torpedoes: number

  /** Days of repair each device still needs. Zero is a working device. */
  damage: Record<DeviceId, number>

  /** Laid out on arrival, thrown away on leaving. */
  raiders: Raider[]
  stars: Coord[]
  base: Coord | null

  docked: boolean

  raidersLeft: number
  raidersKilled: number
  basesLeft: number

  outcome: Outcome | null
}

/**
 * One line of the transcript. The teletype prints these and, when the
 * remaster lands, the tactical view will read them for its log -- so both
 * skins will say exactly the same things.
 */
export interface Line {
  kind: 'system' | 'scan' | 'move' | 'fire' | 'hit' | 'damage' | 'end' | 'win'
  text: string
}

export interface Captain {
  id: number
  name: string
  /** Raiders destroyed. The score, before any tie-break. */
  killed: number
  /** Days left on the orders when it ended. First tie-break. */
  daysLeft: number
  /** Torpedoes still in the racks. Second tie-break. */
  torpedoes: number
  done: boolean
  outcome: Outcome | null
}

export type Phase =
  | 'boot'
  | 'title'
  | 'instructions'
  | 'setup'
  | 'patrol'
  | 'resolve'
  | 'report'
  | 'gameover'
  | 'scores'

/** A command, assembled from as many prompts as it takes to ask for it. */
export type Command =
  | { type: 'nav'; course: number; warp: number }
  | { type: 'srs' }
  | { type: 'lrs' }
  | { type: 'beams'; energy: number }
  | { type: 'torpedo'; course: number }
  | { type: 'shields'; energy: number }
  | { type: 'damage' }
  | { type: 'chart' }
  | { type: 'resign' }
