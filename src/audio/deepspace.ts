import type { Tune } from './synth'

/**
 * The remaster's score, and what it is and is not.
 *
 * It is *not* the television theme, or any part of it, or a paraphrase of
 * one. The reason this game is called Long Range Scan at all is that the
 * setting's names belong to somebody, and it would be a strange sort of care
 * to rename the enemy and then quote sixteen bars of the music. Every note
 * below was written for this project.
 *
 * What it *is* is the idiom, which belongs to nobody: brass in a major key,
 * a melody built on rising fourths and fifths that holds its top note far
 * longer than a pop tune would dare, strings underneath moving one chord a
 * bar, and timpani. That is how film and television have said "space, and it
 * matters" since the 1950s, and it predates all of them -- it is Holst, and
 * before him it is Wagner. Nobody owns a perfect fifth.
 *
 * The instruments are the same six voices the sibling games use, leant on
 * differently:
 *
 *   - **brass** is a detuned saw with the filter closing slightly across
 *     each note, which is what a horn does on the attack;
 *   - **strings** are a quiet pulse-50 playing actual chords -- the engine
 *     stacks them with slashes -- held the whole bar with gate 1;
 *   - **timpani** is the kit's kick, played sparingly enough to read as a
 *     drum somebody is hitting rather than a beat.
 *
 * Eighths, eight to a bar, D major, and slow enough to be serious.
 */

const bar = (...steps: string[]) => steps

/** A chord held for a whole bar. */
const held = (chord: string) => [chord, '=', '=', '=', '=', '=', '=', '=']

/**
 * The theme.
 *
 * Eight bars. It opens on a pickup a fifth below the tonic and holds the
 * arrival for most of a bar, climbs to the high G in bar three and sits
 * there, then comes down. The second half is the same shape starting a
 * fourth lower, so it can climb again and land properly.
 */
export const DEEP_TITLE: Tune = {
  bpm: 72,
  stepsPerBeat: 2,
  tracks: [
    {
      wave: 'saw',
      gain: 0.13,
      gate: 0.96,
      detune: 6,
      filter: { from: 1500, to: 900, q: 1.2 },
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
      // Strings. One chord a bar, and the whole harmonic argument is here:
      // D, D, G, D, Bm, G, A, D.
      wave: 'pulse50',
      gain: 0.045,
      gate: 1,
      notes: [
        ...held('D4/F#4/A4'),
        ...held('D4/F#4/A4'),
        ...held('G3/B3/D4'),
        ...held('D4/F#4/A4'),
        ...held('B3/D4/F#4'),
        ...held('G3/B3/D4'),
        ...held('A3/C#4/E4'),
        ...held('D4/F#4/A4'),
      ],
    },
    {
      wave: 'triangle',
      gain: 0.24,
      gate: 1,
      notes: [
        ...held('D2'),
        ...held('D2'),
        ...held('G1'),
        ...held('D2'),
        ...held('B1'),
        ...held('G1'),
        ...held('A1'),
        ...held('D2'),
      ],
    },
    {
      // Timpani. Two strokes a bar where the melody is holding, a run of
      // four where it is coming home, and nothing at all in between.
      wave: 'noise',
      gain: 0.4,
      notes: [
        ...bar('K', '.', '.', '.', 'K', '.', '.', '.'),
        ...bar('.', '.', '.', '.', '.', '.', '.', '.'),
        ...bar('K', '.', '.', '.', 'K', '.', '.', '.'),
        ...bar('.', '.', '.', '.', '.', '.', '.', '.'),
        ...bar('K', '.', '.', '.', 'K', '.', '.', '.'),
        ...bar('.', '.', '.', '.', '.', '.', '.', '.'),
        ...bar('K', '.', 'K', '.', 'K', '.', 'K', '.'),
        ...bar('K', '.', '.', '.', '.', '.', '.', '.'),
      ],
    },
  ],
}

/**
 * On patrol.
 *
 * The theme is not here, deliberately. What plays while you are counting
 * quadrants has to be furniture -- you are reading a chart over the top of
 * it, and a melody would be unbearable by the fourth warp. So: the same
 * harmony, moving half as fast, with one distant horn call every second bar
 * to say the theme is still out there.
 */
export const DEEP_PATROL: Tune = {
  bpm: 66,
  stepsPerBeat: 2,
  tracks: [
    {
      wave: 'saw',
      gain: 0.055,
      gate: 0.9,
      detune: 5,
      filter: { from: 1100, to: 700, q: 1.2 },
      notes: [
        ...bar('.', '.', '.', '.', '.', '.', 'A4', '.'),
        ...bar('D5', '=', '=', '=', '.', '.', '.', '.'),
        ...bar('.', '.', '.', '.', '.', '.', 'F#4', '.'),
        ...bar('B4', '=', '=', '=', '.', '.', '.', '.'),
      ],
    },
    {
      wave: 'pulse50',
      gain: 0.04,
      gate: 1,
      notes: [
        ...held('D4/F#4/A4'),
        ...held('D4/G4/A4'),
        ...held('B3/D4/F#4'),
        ...held('G3/B3/D4'),
      ],
    },
    {
      wave: 'triangle',
      gain: 0.22,
      gate: 1,
      notes: [...held('D2'), ...held('D2'), ...held('B1'), ...held('G1')],
    },
  ],
}

/**
 * The end of it, either way.
 *
 * A rising line over G, A, Bm, D -- the lift rather than the fanfare,
 * because it plays over the standings and half the captains reading them
 * did not make it back.
 */
export const DEEP_END: Tune = {
  bpm: 72,
  stepsPerBeat: 2,
  tracks: [
    {
      wave: 'saw',
      gain: 0.12,
      gate: 0.96,
      detune: 6,
      filter: { from: 1500, to: 900, q: 1.2 },
      notes: [
        ...bar('D5', '=', '=', '=', '=', '=', '=', '.'),
        ...bar('E5', '=', '=', '=', '=', '=', '=', '.'),
        ...bar('F#5', '=', '=', '=', '=', '=', 'G5', '.'),
        ...bar('A5', '=', '=', '=', '=', '=', '=', '.'),
      ],
    },
    {
      wave: 'pulse50',
      gain: 0.05,
      gate: 1,
      notes: [
        ...held('G3/B3/D4'),
        ...held('A3/C#4/E4'),
        ...held('B3/D4/F#4'),
        ...held('D4/F#4/A4'),
      ],
    },
    {
      wave: 'triangle',
      gain: 0.26,
      gate: 1,
      notes: [...held('G1'), ...held('A1'), ...held('B1'), ...held('D2')],
    },
    {
      wave: 'noise',
      gain: 0.36,
      notes: [
        ...bar('K', '.', '.', '.', '.', '.', '.', '.'),
        ...bar('K', '.', '.', '.', '.', '.', '.', '.'),
        ...bar('K', '.', '.', '.', 'K', '.', '.', '.'),
        ...bar('K', '.', 'K', '.', 'K', '.', '.', '.'),
      ],
    },
  ],
}
