import { describe, expect, it } from 'vitest'
import { DEEP_END, DEEP_PATROL, DEEP_TITLE } from './deepspace'
import { noteToFreq, type Tune } from './synth'
import { END_TUNE, PATROL_TUNE, TITLE_TUNE } from './tunes'

/**
 * The music cannot be listened to by a test, but it can be proved to be
 * playable, which is the half that fails silently.
 *
 * A mistyped note name does not throw: `noteToFreq` returns 0, the oscillator
 * is set to 0 Hz, and that voice simply is not there for the rest of the
 * piece. You would have to notice a missing inner part by ear, in a tune you
 * have heard forty times while testing something else. So every step of every
 * track is checked here instead.
 */

const KIT = new Set(['K', 'S', 'C', 'H', 'O'])
const TUNES: [string, Tune][] = [
  ['TITLE_TUNE', TITLE_TUNE],
  ['PATROL_TUNE', PATROL_TUNE],
  ['END_TUNE', END_TUNE],
  ['DEEP_TITLE', DEEP_TITLE],
  ['DEEP_PATROL', DEEP_PATROL],
  ['DEEP_END', DEEP_END],
]

describe.each(TUNES)('%s', (_name, tune) => {
  it('names a note the synth can find, on every step of every track', () => {
    for (const track of tune.tracks) {
      for (const step of track.notes) {
        if (step === '.' || step === '=') continue
        if (track.wave === 'noise') {
          expect(KIT).toContain(step)
          continue
        }
        // Chords are stacked with slashes; every voice in one has to parse.
        for (const note of step.split('/')) {
          expect(noteToFreq(note), `${note} in ${step}`).toBeGreaterThan(0)
        }
      }
    }
  })

  it('is the same length on every track, so the loop does not drift', () => {
    const lengths = new Set(tune.tracks.map((t) => t.notes.length))
    expect(lengths.size).toBe(1)
  })

  it('starts on a note rather than a tie', () => {
    // '=' sustains the previous step, and there is no previous step at zero.
    for (const track of tune.tracks) expect(track.notes[0]).not.toBe('=')
  })
})
