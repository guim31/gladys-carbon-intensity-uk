// -----------------------------------------------------------------------------
// Integration configuration.
//
// Filled in by the user in Gladys from the `config_schema` of
// `gladys-assistant-integration.json`. This module provides the defaults and
// normalizes the received object, so the rest of the code never deals with
// `undefined` or with a value typed by hand with stray spaces.
//
// The zones followed, one device each:
//   - Great Britain as a whole ("national"),
//   - any of the 17 regions of the API (14 DNO regions, England, Scotland,
//     Wales), by id,
//   - any number of postcodes, by their outward part ("RG10" from "RG10 9AB"):
//     the API maps it to its DNO region.
// -----------------------------------------------------------------------------

/** The languages of the Gladys interface, every text exists in all four. */
export const LANGUAGES = ['en', 'fr', 'de', 'es'];

/** The region ids the API knows (1–14 DNO regions, 15 England, 16 Scotland, 17 Wales). */
export const REGION_IDS = Array.from({ length: 17 }, (_, i) => String(i + 1));

/** The durations offered for the best window, in minutes (half-hour slots). */
export const WINDOW_MINUTES = ['30', '60', '90', '120', '180', '240', '300', '360'];

/** Postcodes followed at most: each one is a call every half-hour. */
export const MAX_POSTCODES = 5;

/** The outward part of a UK postcode: "RG10", "EH1", "SW1A", "M1". */
const OUTWARD = /^[A-Z]{1,2}[0-9][A-Z0-9]?$/;

// Defaults: they MUST stay consistent with the `default` values declared in the
// `config_schema` of the manifest (test/manifest.test.js checks it).
export const DEFAULT_CONFIG = {
  // Language of the feature names (frozen when a device is added) and of the
  // texts the container produces where Gladys does not say the user's
  // language (scene events, text states, action messages).
  language: 'fr',
  national: true,
  // A multi_select stores an array: no default in the manifest.
  regions: [],
  postcodes: '',
  best_window_minutes: '180',
};

/**
 * Merge the user config with the defaults.
 * @param {Record<string, unknown>} raw config returned by the SDK
 */
export function normalizeConfig(raw = {}) {
  const language = String(raw.language ?? DEFAULT_CONFIG.language);
  const minutes = String(raw.best_window_minutes ?? DEFAULT_CONFIG.best_window_minutes).trim();
  const { postcodes, rejected } = parsePostcodes(raw.postcodes);
  return {
    language: LANGUAGES.includes(language) ? language : DEFAULT_CONFIG.language,
    national: raw.national === undefined ? DEFAULT_CONFIG.national : toBoolean(raw.national),
    regions: normalizeRegions(raw.regions),
    postcodes,
    rejectedPostcodes: rejected,
    bestWindowMinutes: Number(
      WINDOW_MINUTES.includes(minutes) ? minutes : DEFAULT_CONFIG.best_window_minutes,
    ),
  };
}

function toBoolean(value) {
  return value === true || value === 'true' || value === 1 || value === '1';
}

/**
 * The regions chosen: an array from the multi_select (a comma-separated
 * string is accepted too), unknown ids dropped, without duplicates, in
 * numeric order.
 * @param {unknown} raw
 * @returns {string[]}
 */
function normalizeRegions(raw) {
  const list = Array.isArray(raw) ? raw : typeof raw === 'string' ? raw.split(',') : [];
  const ids = list.map((id) => String(id).trim()).filter((id) => REGION_IDS.includes(id));
  return [...new Set(ids)].sort((a, b) => Number(a) - Number(b));
}

/**
 * "rg10 9ab, EH1;  SW1A 1AA" → ["RG10", "EH1", "SW1A"]: the outward part
 * only (the API wants nothing more precise), upper case, without duplicates,
 * at most MAX_POSTCODES. What does not look like a postcode is returned apart,
 * for a warning.
 * @param {unknown} raw
 */
export function parsePostcodes(raw) {
  const postcodes = [];
  const rejected = [];
  for (const entry of String(raw ?? '').split(/[,;\n]+/)) {
    const text = entry.trim().toUpperCase();
    if (text === '') {
      continue;
    }
    // "RG109AB" typed without its space: the inward part is a digit and two letters.
    const first = text.split(/\s+/)[0];
    const outward = first.length > 4 ? first.replace(/\d[A-Z]{2}$/, '') : first;
    if (!OUTWARD.test(outward)) {
      rejected.push(text.slice(0, 20));
    } else if (!postcodes.includes(outward)) {
      postcodes.push(outward);
    }
  }
  return {
    postcodes: postcodes.slice(0, MAX_POSTCODES),
    rejected: [...rejected, ...postcodes.slice(MAX_POSTCODES)],
  };
}

/**
 * The zones of a configuration, in a stable order: national, regions,
 * postcodes. A zone's `key` is the platform id of its device: frozen.
 * @param {ReturnType<typeof normalizeConfig>} config
 * @returns {Array<{ key: string, kind: 'national' | 'region' | 'postcode', id?: string }>}
 */
export function zonesOf(config) {
  return [
    ...(config.national ? [{ key: 'national', kind: 'national' }] : []),
    ...config.regions.map((id) => ({ key: `region-${id}`, kind: 'region', id })),
    ...config.postcodes.map((code) => ({
      key: `postcode-${code.toLowerCase()}`,
      kind: 'postcode',
      id: code,
    })),
  ];
}
