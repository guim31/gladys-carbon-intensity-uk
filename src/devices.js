// -----------------------------------------------------------------------------
// One device per zone followed (Great Britain, a region, a postcode), and its
// states.
//
//   grid-carbon-sensor/carbon-intensity     intensity of the slot in progress,
//                                           gCO₂eq/kWh (NESO forecast)
//   counter-sensor/integer                  the NESO index, 1 very low … 5 very
//                                           high, so a scene compares numbers
//   text/text                               the same index as a word, in the
//                                           language of the configuration
//   grid-carbon-sensor/…-percentage         low-carbon and renewable shares
//   counter-sensor/integer + percent        the share of each fuel (Gladys has
//                                           no generic percentage sensor)
//   text/text                               start of the best window ("17:30")
//   duration/integer + minutes              minutes until it starts (0: now)
//   grid-carbon-sensor/carbon-intensity     its average intensity
//
// Ids are built from the zone key ("national", "region-13", "postcode-rg10"):
// stable, never a label. No poll frequency: the data moves every 30 minutes,
// the container pushes the states from its own timer (src/app.js).
// -----------------------------------------------------------------------------

import {
  DEVICE_FEATURE_CATEGORIES,
  DEVICE_FEATURE_TYPES,
  DEVICE_FEATURE_UNITS,
} from '@gladysassistant/integration-sdk';
import { FUELS, lowCarbonShare, renewableShare } from './api.js';
import { zonesOf } from './config.js';
import { bestWindow, currentSlot, minutesUntil } from './forecast.js';
import { INDEX_TEXT, NAMES, clockTime, pick, zoneName } from './i18n.js';

export const ZONE = 'zone';

/** Feature keys: frozen once published (Gladys keys history and scenes on them). */
export const FEATURES = [
  'intensity',
  'index',
  'index_label',
  'low_carbon_share',
  'renewable_share',
  ...FUELS.map((fuel) => `${fuel}_share`),
  'best_window_start',
  'best_window_in',
  'best_window_intensity',
];

/** The UK record is under 1000 g/kWh: display bound. */
const INTENSITY_MAX = 1000;

/** A national mix older than this is not published: better none than a stale one. */
export const MIX_MAX_AGE_MS = 2 * 60 * 60 * 1000;

export const zoneIds = (gladys, zone) => gladys.externalIds(ZONE, zone.key);

const base = { read_only: true, has_feedback: false, keep_history: true };

/**
 * The discovery payload: one device per zone.
 * @param {object} gladys
 * @param {ReturnType<import('./config.js').normalizeConfig>} config
 */
export function buildDevices(gladys, config) {
  return zonesOf(config).map((zone) => buildZoneDevice(gladys, config.language, zone));
}

function buildZoneDevice(gladys, language, zone) {
  const names = NAMES[language] ?? NAMES.fr;
  const ids = zoneIds(gladys, zone);
  const feature = (key, definition) => ({
    ...base,
    ...definition,
    name: names[key],
    external_id: ids.feature(key),
  });
  const intensity = (key) =>
    feature(key, {
      category: DEVICE_FEATURE_CATEGORIES.GRID_CARBON_SENSOR,
      type: DEVICE_FEATURE_TYPES.GRID_CARBON_SENSOR.CARBON_INTENSITY,
      unit: DEVICE_FEATURE_UNITS.GRAM_CO2_EQ_PER_KILOWATT_HOUR,
      min: 0,
      max: INTENSITY_MAX,
    });
  const percent = (key, type) =>
    feature(key, {
      category: DEVICE_FEATURE_CATEGORIES.GRID_CARBON_SENSOR,
      type,
      unit: DEVICE_FEATURE_UNITS.PERCENT,
      min: 0,
      max: 100,
    });
  const text = (key) =>
    feature(key, {
      category: DEVICE_FEATURE_CATEGORIES.TEXT,
      type: DEVICE_FEATURE_TYPES.TEXT.TEXT,
      min: 0,
      max: 0,
      keep_history: false,
    });
  return {
    name: `${names.device} ${pick(zoneName(zone), language)}`,
    external_id: ids.device,
    should_poll: false,
    features: [
      intensity('intensity'),
      feature('index', {
        category: DEVICE_FEATURE_CATEGORIES.COUNTER_SENSOR,
        type: DEVICE_FEATURE_TYPES.SENSOR.INTEGER,
        min: 1,
        max: 5,
      }),
      text('index_label'),
      percent('low_carbon_share', DEVICE_FEATURE_TYPES.GRID_CARBON_SENSOR.CARBON_FREE_PERCENTAGE),
      percent('renewable_share', DEVICE_FEATURE_TYPES.GRID_CARBON_SENSOR.RENEWABLE_PERCENTAGE),
      ...FUELS.map((fuel) =>
        feature(`${fuel}_share`, {
          category: DEVICE_FEATURE_CATEGORIES.COUNTER_SENSOR,
          type: DEVICE_FEATURE_TYPES.SENSOR.INTEGER,
          unit: DEVICE_FEATURE_UNITS.PERCENT,
          min: 0,
          max: 100,
        }),
      ),
      text('best_window_start'),
      feature('best_window_in', {
        category: DEVICE_FEATURE_CATEGORIES.DURATION,
        type: DEVICE_FEATURE_TYPES.DURATION.INTEGER,
        unit: DEVICE_FEATURE_UNITS.MINUTES,
        min: 0,
        max: 1440,
        // A countdown: no history, and rounded to 5 minutes so it is not a
        // new state every minute.
        keep_history: false,
      }),
      intensity('best_window_intensity'),
    ],
  };
}

/**
 * The mix to show for a zone right now: the slot's own for a region, the
 * latest national one (if fresh) for Great Britain.
 */
export function zoneMix(reading, now) {
  if (!reading) {
    return null;
  }
  const slot = currentSlot(reading.slots, now);
  if (slot?.mix) {
    return slot.mix;
  }
  if (reading.mix && reading.mixAt && now - Date.parse(reading.mixAt) <= MIX_MAX_AGE_MS) {
    return reading.mix;
  }
  return null;
}

const round1 = (value) => Math.round(value * 10) / 10;

/**
 * The states of a zone from its latest reading, at `now`.
 * @param {object} gladys
 * @param {{ key: string }} zone
 * @param {object | null} reading what src/api.js fetchZone returned
 * @param {object} options
 * @param {number} options.now
 * @param {string} options.language
 * @param {number} options.windowMinutes
 * @param {string} [options.timeZone]
 */
export function zoneStates(gladys, zone, reading, { now, language, windowMinutes, timeZone }) {
  const slot = reading ? currentSlot(reading.slots, now) : null;
  if (!slot) {
    return [];
  }
  const ids = zoneIds(gladys, zone);
  const state = (key, value) => ({ device_feature_external_id: ids.feature(key), state: value });
  const text = (key, value) => ({ device_feature_external_id: ids.feature(key), text: value });
  const states = [state('intensity', Math.round(slot.intensity))];
  if (slot.index) {
    states.push(
      state('index', slot.index),
      text('index_label', pick(INDEX_TEXT[slot.index], language)),
    );
  }
  const mix = zoneMix(reading, now);
  if (mix) {
    states.push(
      state('low_carbon_share', round1(lowCarbonShare(mix))),
      state('renewable_share', round1(renewableShare(mix))),
      ...FUELS.map((fuel) => state(`${fuel}_share`, Math.round(mix[fuel]))),
    );
  }
  const best = bestWindow(reading.slots, now, windowMinutes);
  if (best) {
    states.push(
      text('best_window_start', clockTime(best.start, timeZone)),
      state('best_window_in', Math.ceil(minutesUntil(best.start, now) / 5) * 5),
      state('best_window_intensity', Math.round(best.average)),
    );
  }
  return states;
}
