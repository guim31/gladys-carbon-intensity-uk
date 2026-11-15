// -----------------------------------------------------------------------------
// What the integration computes from a zone's 48-hour forecast: the slot in
// progress, the next 24 hours, and the best window of the next 24 hours.
//
// The best window of D minutes is the run of D/30 consecutive half-hour slots
// with the lowest average intensity, among those that END within the 24 hours
// starting with the slot in progress (a window starting now counts). Ties go
// to the earliest window. A forecast that does not cover the whole window is
// never used: a window is only offered when every slot of it is known.
// -----------------------------------------------------------------------------

export const SLOT_MS = 30 * 60 * 1000;
export const HORIZON_SLOTS = 48;

/** Start of the half-hour slot holding `now`. */
export function slotStart(now) {
  return Math.floor(now / SLOT_MS) * SLOT_MS;
}

/**
 * The slots from the one in progress on, at most `count`.
 * @param {import('./api.js').Slot[]} slots
 * @param {number} now
 * @param {number} [count]
 */
export function upcoming(slots, now, count = HORIZON_SLOTS) {
  const start = slotStart(now);
  const ahead = (slots ?? []).filter((slot) => Date.parse(slot.from) >= start);
  // The forecast must start with the slot in progress and have no hole.
  const run = [];
  for (const slot of ahead) {
    if (Date.parse(slot.from) !== start + run.length * SLOT_MS) {
      break;
    }
    run.push(slot);
    if (run.length === count) {
      break;
    }
  }
  return run;
}

/**
 * The slot in progress, or null when the forecast does not cover it.
 * @param {import('./api.js').Slot[]} slots
 * @param {number} now
 */
export function currentSlot(slots, now) {
  return upcoming(slots, now, 1)[0] ?? null;
}

/**
 * @param {import('./api.js').Slot[]} slots
 * @param {number} now
 * @param {number} minutes duration of the window, a multiple of 30
 * @returns {{ start: number, end: number, average: number } | null}
 */
export function bestWindow(slots, now, minutes) {
  const length = Math.max(1, Math.round(minutes / 30));
  const next = upcoming(slots, now);
  if (next.length < length) {
    return null;
  }
  let best = null;
  let sum = next.slice(0, length).reduce((total, slot) => total + slot.intensity, 0);
  for (let i = 0; i + length <= next.length; i += 1) {
    if (i > 0) {
      sum += next[i + length - 1].intensity - next[i - 1].intensity;
    }
    // Rounded to a tenth: float drift must not make a later window "better".
    const average = Math.round((sum / length) * 10) / 10;
    if (!best || average < best.average) {
      best = { start: Date.parse(next[i].from), average };
    }
  }
  return { ...best, end: best.start + length * SLOT_MS };
}

/** Minutes from now to a start, 0 once it has begun. */
export function minutesUntil(start, now) {
  return Math.max(0, Math.ceil((start - now) / 60_000));
}
