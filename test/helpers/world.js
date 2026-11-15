// -----------------------------------------------------------------------------
// A complete test world: the SDK's fake Gladys, a fake Carbon Intensity API
// behind a fake `fetch` serving real answers (15/11/2026), a temporary /data
// and a manual clock, with the integration wired on top through
// registerHandlers. No timer runs unless `timers: true`: the tests call
// `app.tick()`. No test touches the network.
// -----------------------------------------------------------------------------

import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { registerHandlers } from '../../src/app.js';
import { Store } from '../../src/store.js';
import { API_URL } from '../../src/api.js';
import { normalizeConfig, zonesOf } from '../../src/config.js';
import { zoneIds } from '../../src/devices.js';

// The integration logs its lifecycle; keep the test output readable.
process.env.LOG_LEVEL ??= 'silent';

export const fixture = (name) =>
  JSON.parse(readFileSync(new URL(`../fixtures/${name}`, import.meta.url), 'utf8'));

/** Real answers, read on 15/11/2026 at 16:20 UTC. */
export const NATIONAL_BODY = fixture('national-fw48h.json');
export const GENERATION_BODY = fixture('generation.json');
export const RG10_BODY = fixture('postcode-rg10-fw48h.json');
export const EH1_BODY = fixture('postcode-eh1-fw48h.json');
export const LONDON_BODY = fixture('region-13-fw48h.json');

/** 2026-11-15 16:20 UTC: inside the first slot of the fixtures (16:00–16:30). */
export const START = Date.UTC(2026, 10, 15, 16, 20, 0);
export const TIME_ZONE = 'Europe/London';

/** A manual clock. */
export function createClock(start = START) {
  const clock = {
    time: start,
    now: () => clock.time,
    advance(ms) {
      clock.time += ms;
    },
  };
  return clock;
}

export const json = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

/**
 * A fake Carbon Intensity API. Its answers can be changed between two calls
 * (`api.answer = (url) => Response`); every URL is recorded.
 */
export function createFakeApi() {
  const api = {
    calls: [],
    down: false,
    bodies: {
      national: NATIONAL_BODY,
      generation: GENERATION_BODY,
      'postcode/RG10': RG10_BODY,
      'postcode/EH1': EH1_BODY,
      'regionid/13': LONDON_BODY,
    },
    answer(url) {
      const path = url.slice(API_URL.length);
      if (path === '/generation') {
        return json(200, api.bodies.generation);
      }
      if (/^\/intensity\/[^/]+\/fw48h$/.test(path)) {
        return json(200, api.bodies.national);
      }
      const regional = path.match(/^\/regional\/intensity\/[^/]+\/fw48h\/(.+)$/);
      if (regional) {
        if (/^regionid\//.test(regional[1]) && !/^regionid\/([1-9]|1[0-7])$/.test(regional[1])) {
          return json(400, { error: { code: '400 Bad Request', message: 'valid region ID' } });
        }
        // An unknown postcode: HTTP 200 and `null`, as the real API does.
        return json(200, api.bodies[regional[1]] ?? null);
      }
      return json(404, { error: 'not found' });
    },
    /** @type {typeof fetch} */
    fetch: async (url) => {
      api.calls.push(String(url));
      if (api.down) {
        throw new TypeError('fetch failed', { cause: { code: 'ENOTFOUND' } });
      }
      return api.answer(String(url));
    },
    count: (part) => api.calls.filter((url) => url.includes(part)).length,
  };
  return api;
}

/**
 * @param {object} [options]
 * @param {object} [options.config] raw integration config
 * @param {boolean} [options.created] the devices are already added in Gladys
 * @param {ReturnType<typeof createFakeApi>} [options.api]
 * @param {ReturnType<typeof createClock>} [options.clock]
 * @param {string} [options.dataDir] reuse a /data (restart)
 * @param {boolean} [options.connect]
 * @param {boolean} [options.timers] run the minute timer (with mock timers)
 */
export async function createWorld({
  config = { postcodes: 'RG10' },
  created = true,
  api = createFakeApi(),
  clock = createClock(),
  dataDir = mkdtempSync(join(tmpdir(), 'carbon-test-')),
  connect = true,
  timers = false,
} = {}) {
  const fake = createFakeGladys({ config });
  const gladys = fake;
  if (created) {
    const zones = zonesOf(normalizeConfig(config));
    gladys.fake.devices = zones.map((zone) => ({
      external_id: zoneIds(gladys, zone).device,
      name: `Device ${zone.key}`,
      features: [],
    }));
  }
  const app = registerHandlers(gladys, {
    fetch: api.fetch,
    store: new Store(dataDir),
    now: clock.now,
    timers,
    timeZone: TIME_ZONE,
  });
  if (connect) {
    await gladys.connect();
  }
  return { gladys, fake: gladys.fake, app, api, clock, dataDir };
}

/** The devices discovered for a configuration. */
export async function discoveredDevices(config) {
  const world = await createWorld({ config, created: false });
  await world.app.stop();
  return world.fake.discoveredDevices;
}

/**
 * A copy of a forecast body (national or regional) whose slot starting at
 * `from` gets another intensity and index.
 */
export function withSlot(body, from, { forecast, index }) {
  const copy = structuredClone(body);
  const rows = Array.isArray(copy.data) ? copy.data : copy.data.data;
  const row = rows.find((r) => Date.parse(r.from) === Date.parse(from));
  if (forecast !== undefined) {
    row.intensity.forecast = forecast;
  }
  if (index !== undefined) {
    row.intensity.index = index;
  }
  return copy;
}
