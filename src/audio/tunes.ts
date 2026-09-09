import type { Tune } from './synth'

/**
 * The 1971 skin's music, and a word about what it is honestly claiming.
 *
 * The original was silent. It ran on a mainframe through a printing
 * terminal, and a printing terminal's only instrument is its own print head
 * -- which this game does play, in `synth.print()`. So a chiptune here is not
 * a restoration of anything, and is not pretending to be.
 *
 * What it is instead: the music the game would have got when it followed
 * everybody home. The listing spread through Creative Computing and was typed
 * into every machine of the next decade, and somebody porting a space game to
 * a home computer in 1981 had three channels and a noise generator and every
 * intention of sounding like a film.
 *
 * So this is the same theme the remaster plays -- same key, same eight bars,
 * same chords underneath -- arranged for what that machine actually had. The
 * remaster is a remaster of the music too, which is the point: switching skin
 * re-scores the piece rather than changing the record.
 *
 * See `deepspace.ts` for the theme itself and for why an idiom is not a
 * quotation. Eighths, eight to a bar, D major.
 */

const bar = (...notes: string[]) => notes

/** The theme, on the loudest voice the machine has. */
export const TITLE_TUNE: Tune = {
  bpm: 132,
  stepsPerBeat: 2,
  tracks: [
    {
      wave: 'pulse25',
      gain: 0.16,
      notes: [
        ...bar('.', '.', '.', 'A4', 'D5', '=', '=', '='),
        ...bar('D5', '=', '=', '=', 'E5', '.', 'F#5', '.'),
        ...bar('G5', '=', '=', '=', '=', '=', '.', '.'),
        ...bar('F#5', '.', 'E5', '.', 'D5', '=', '=', '.'),
        ...bar('.', '.', '.', 'A4', 'B4', '=', '=', '='),
        ...bar('B4', '=', '=', '.', 'C#5', '.', 'D5', '.'),
        ...bar('E5', '=', '=', '=', 'D5', '.', 'C#5', '.'),
        ...bar('D5', '=', '=', '=', '=', '=', '=', '.'),
      ],
    },
    {
      /*
       * The strings, as a home computer had to do them: no chord voice, so
       * the chord is arpeggiated fast underneath and your ear assembles it.
       * This is the single most 1981 thing in the repository.
       */
      wave: 'pulse12',
      gain: 0.05,
      notes: [
        ...bar('D4', 'F#4', 'A4', 'F#4', 'D4', 'F#4', 'A4', 'F#4'),
        ...bar('D4', 'F#4', 'A4', 'F#4', 'D4', 'F#4', 'A4', 'F#4'),
        ...bar('G3', 'B3', 'D4', 'B3', 'G3', 'B3', 'D4', 'B3'),
        ...bar('D4', 'F#4', 'A4', 'F#4', 'D4', 'F#4', 'A4', 'F#4'),
        ...bar('B3', 'D4', 'F#4', 'D4', 'B3', 'D4', 'F#4', 'D4'),
        ...bar('G3', 'B3', 'D4', 'B3', 'G3', 'B3', 'D4', 'B3'),
        ...bar('A3', 'C#4', 'E4', 'C#4', 'A3', 'C#4', 'E4', 'C#4'),
        ...bar('D4', 'F#4', 'A4', 'F#4', 'D4', 'F#4', 'A4', 'F#4'),
      ],
    },
    {
      wave: 'triangle',
      gain: 0.21,
      notes: [
        ...bar('D2', '.', 'D2', '.', 'A2', '.', 'D2', '.'),
        ...bar('D2', '.', 'D2', '.', 'A2', '.', 'D2', '.'),
        ...bar('G1', '.', 'G1', '.', 'D2', '.', 'G1', '.'),
        ...bar('D2', '.', 'D2', '.', 'A2', '.', 'D2', '.'),
        ...bar('B1', '.', 'B1', '.', 'F#2', '.', 'B1', '.'),
        ...bar('G1', '.', 'G1', '.', 'D2', '.', 'G1', '.'),
        ...bar('A1', '.', 'A1', '.', 'E2', '.', 'A1', '.'),
        ...bar('D2', '.', 'A1', '.', 'D2', '=', '=', '.'),
      ],
    },
    {
      // The timpani, as noise, because that is what there was.
      wave: 'noise',
      gain: 0.34,
      notes: [
        ...bar('K', '.', 'H', '.', 'K', '.', 'H', '.'),
        ...bar('.', '.', 'H', '.', '.', '.', 'H', '.'),
        ...bar('K', '.', 'H', '.', 'K', '.', 'H', '.'),
        ...bar('.', '.', 'H', '.', '.', '.', 'H', 'H'),
        ...bar('K', '.', 'H', '.', 'K', '.', 'H', '.'),
        ...bar('.', '.', 'H', '.', '.', '.', 'H', '.'),
        ...bar('K', '.', 'K', '.', 'K', '.', 'K', '.'),
        ...bar('K', '.', '.', '.', 'S', '.', '.', '.'),
      ],
    },
  ],
}

/**
 * On patrol. Four bars, almost empty, with the horn call from the theme
 * every second bar and nothing else. Anything more would be unbearable by
 * the fourth warp.
 */
export const PATROL_TUNE: Tune = {
  bpm: 112,
  stepsPerBeat: 2,
  tracks: [
    {
      wave: 'pulse50',
      gain: 0.07,
      notes: [
        ...bar('.', '.', '.', '.', '.', '.', 'A4', '.'),
        ...bar('D5', '=', '=', '=', '.', '.', '.', '.'),
        ...bar('.', '.', '.', '.', '.', '.', 'F#4', '.'),
        ...bar('B4', '=', '=', '=', '.', '.', '.', '.'),
      ],
    },
    {
      wave: 'triangle',
      gain: 0.18,
      notes: [
        ...bar('D2', '=', '=', '=', '.', '.', 'D2', '.'),
        ...bar('D2', '=', '=', '=', '.', '.', 'A1', '.'),
        ...bar('B1', '=', '=', '=', '.', '.', 'B1', '.'),
        ...bar('G1', '=', '=', '=', '.', '.', 'G1', '.'),
      ],
    },
    {
      wave: 'noise',
      gain: 0.15,
      notes: Array.from({ length: 4 }, () =>
        bar('.', '.', 'H', '.', '.', '.', 'H', '.'),
      ).flat(),
    },
  ],
}

/** The end of it, either way: the same rising cadence the remaster ends on. */
export const END_TUNE: Tune = {
  bpm: 120,
  stepsPerBeat: 2,
  tracks: [
    {
      wave: 'pulse25',
      gain: 0.16,
      notes: [
        ...bar('D5', '=', '=', '=', '=', '=', '=', '.'),
        ...bar('E5', '=', '=', '=', '=', '=', '=', '.'),
        ...bar('F#5', '=', '=', '=', '=', '=', 'G5', '.'),
        ...bar('A5', '=', '=', '=', '=', '=', '=', '.'),
      ],
    },
    {
      wave: 'pulse12',
      gain: 0.05,
      notes: [
        ...bar('G3', 'B3', 'D4', 'B3', 'G3', 'B3', 'D4', 'B3'),
        ...bar('A3', 'C#4', 'E4', 'C#4', 'A3', 'C#4', 'E4', 'C#4'),
        ...bar('B3', 'D4', 'F#4', 'D4', 'B3', 'D4', 'F#4', 'D4'),
        ...bar('D4', 'F#4', 'A4', 'F#4', 'D4', 'F#4', 'A4', 'F#4'),
      ],
    },
    {
      wave: 'triangle',
      gain: 0.22,
      notes: [
        ...bar('G1', '=', '=', '=', 'G1', '.', '.', '.'),
        ...bar('A1', '=', '=', '=', 'A1', '.', '.', '.'),
        ...bar('B1', '=', '=', '=', 'B1', '.', '.', '.'),
        ...bar('D2', '=', '=', '=', '=', '=', '=', '.'),
      ],
    },
  ],
}
