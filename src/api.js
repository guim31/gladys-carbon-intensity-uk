// -----------------------------------------------------------------------------
// The Carbon Intensity API of NESO (api.carbonintensity.org.uk): no key, no
// account, CC BY 4.0. One zone read = its forecast for the next 48 hours, in
// half-hour slots starting with the slot in progress:
//
//   national  GET /intensity/{now}/fw48h          intensity and index only
//             GET /generation                     the current national mix
//   region    GET /regional/intensity/{now}/fw48h/regionid/{1-17}
//   postcode  GET /regional/intensity/{now}/fw48h/postcode/{outward}
//             (the regional answers carry the mix of every slot)
//
// The intensity of a slot is NESO's forecast: the "actual" national figure
// only exists for slots already over, and the regions have none at all.
// Answers seen on 15/11/2026: an unknown postcode gives HTTP 200 with the body
// `null` (the routes without a date give a 400), an unknown region id a 400.
// -----------------------------------------------------------------------------

import { HttpError, requestJson } from './http.js';

export const API_URL = 'https://api.carbonintensity.org.uk';

/** The fuels of the API, in its order; anything else is ignored. */
export const FUELS = [
  'biomass',
  'coal',
  'imports',
  'gas',
  'nuclear',
  'other',
  'hydro',
  'solar',
  'wind',
];

/** The API's index, from best to worst → 1…5 (the index feature). */
export const INDEX_LEVELS = { 'very low': 1, low: 2, moderate: 3, high: 4, 'very high': 5 };

/** The postcode is unknown to the API: retrying will not help. */
export class UnknownZoneError extends Error {
  constructor(message) {
    super(message);
    this.name = 'UnknownZoneError';
  }
}

/** "2026-11-15T16:20Z": the minute format the API takes in its routes. */
export function apiTime(ms) {
  return `${new Date(ms).toISOString().slice(0, 16)}Z`;
}

/**
 * Read one zone.
 * @param {typeof fetch} fetchImpl
 * @param {{ kind: string, id?: string }} zone
 * @param {number} now
 * @returns {Promise<{ name: string | null, slots: Slot[], mix: Record<string, number> | null, mixAt: string | null }>}
 *
 * @typedef {{ from: string, to: string, intensity: number, index: number | null, mix: Record<string, number> | null }} Slot
 */
export async function fetchZone(fetchImpl, zone, now) {
  const from = apiTime(now);
  if (zone.kind === 'national') {
    const [forecast, generation] = await Promise.all([
      requestJson(fetchImpl, `${API_URL}/intensity/${from}/fw48h`, {}, 'Carbon Intensity API'),
      // The mix is a bonus: the zone still has its intensity without it.
      requestJson(fetchImpl, `${API_URL}/generation`, {}, 'Carbon Intensity API').catch(() => null),
    ]);
    if (!Array.isArray(forecast?.data)) {
      throw new HttpError('Carbon Intensity API answered without data');
    }
    const mix = generation?.data?.generationmix ? parseMix(generation.data.generationmix) : null;
    return {
      name: null,
      slots: parseSlots(forecast.data),
      mix,
      mixAt: mix ? (toIso(generation.data.from) ?? null) : null,
    };
  }
  const path =
    zone.kind === 'region'
      ? `regionid/${encodeURIComponent(zone.id)}`
      : `postcode/${encodeURIComponent(zone.id)}`;
  let body;
  try {
    body = await requestJson(
      fetchImpl,
      `${API_URL}/regional/intensity/${from}/fw48h/${path}`,
      {},
      'Carbon Intensity API',
    );
  } catch (err) {
    if (err.status === 400) {
      throw new UnknownZoneError(`${zone.kind} ${zone.id} unknown to the Carbon Intensity API`);
    }
    throw err;
  }
  if (body === null || body?.data === null) {
    throw new UnknownZoneError(`${zone.kind} ${zone.id} unknown to the Carbon Intensity API`);
  }
  // The routes by region answer an object, some mirrors an array of one.
  const data = Array.isArray(body?.data) ? body.data[0] : body?.data;
  if (!Array.isArray(data?.data)) {
    throw new HttpError('Carbon Intensity API answered without data');
  }
  return {
    name: typeof data.shortname === 'string' ? data.shortname : null,
    slots: parseSlots(data.data),
    mix: null,
    mixAt: null,
  };
}

/** "2026-11-15T16:00Z" → ISO, or null. */
function toIso(text) {
  const ms = Date.parse(text);
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}

/** @returns {Slot[]} sorted, without the slots the API left incomplete */
export function parseSlots(rows) {
  const slots = [];
  for (const row of rows) {
    const from = toIso(row?.from);
    const to = toIso(row?.to);
    const intensity = row?.intensity?.actual ?? row?.intensity?.forecast;
    if (!from || !to || typeof intensity !== 'number' || !Number.isFinite(intensity)) {
      continue;
    }
    slots.push({
      from,
      to,
      intensity: Math.max(0, intensity),
      index: INDEX_LEVELS[row.intensity.index] ?? null,
      mix: Array.isArray(row.generationmix) ? parseMix(row.generationmix) : null,
    });
  }
  return slots.sort((a, b) => Date.parse(a.from) - Date.parse(b.from));
}

/** [{ fuel, perc }] → { biomass: 5.2, … }, every fuel present (0 when absent). */
export function parseMix(rows) {
  const mix = Object.fromEntries(FUELS.map((fuel) => [fuel, 0]));
  for (const row of rows) {
    if (FUELS.includes(row?.fuel) && Number.isFinite(row.perc)) {
      mix[row.fuel] = Math.max(0, row.perc);
    }
  }
  return mix;
}

/** Wind, solar, hydro and biomass: what NESO counts as renewable. */
export function renewableShare(mix) {
  return mix.wind + mix.solar + mix.hydro + mix.biomass;
}

/** Every non-fossil source (renewables and nuclear); imports and "other" count as unknown. */
export function lowCarbonShare(mix) {
  return renewableShare(mix) + mix.nuclear;
}
