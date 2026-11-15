// -----------------------------------------------------------------------------
// The API client on the real answers of 15/11/2026, and the best window.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { API_URL, UnknownZoneError, apiTime, fetchZone, parseSlots } from '../src/api.js';
import { normalizeConfig, parsePostcodes, zonesOf } from '../src/config.js';
import { SLOT_MS, bestWindow, currentSlot, minutesUntil, upcoming } from '../src/forecast.js';
import { HttpError } from '../src/http.js';
import { clockTime } from '../src/i18n.js';
import { LONDON_BODY, NATIONAL_BODY, START, createFakeApi, json } from './helpers/world.js';

/** Hand-made slots from a list of intensities, starting at START's slot. */
function slots(values, first = Date.UTC(2026, 10, 15, 16, 0)) {
  return values.map((intensity, i) => ({
    from: new Date(first + i * SLOT_MS).toISOString(),
    to: new Date(first + (i + 1) * SLOT_MS).toISOString(),
    intensity,
    index: 3,
    mix: null,
  }));
}

test('the national zone: forecast of 96 slots and the current mix', async () => {
  const api = createFakeApi();
  const reading = await fetchZone(api.fetch, { kind: 'national' }, START);
  assert.deepEqual(api.calls.sort(), [
    `${API_URL}/generation`,
    `${API_URL}/intensity/2026-11-15T16:20Z/fw48h`,
  ]);
  assert.equal(reading.slots.length, 96);
  assert.deepEqual(reading.slots[0], {
    from: '2026-11-15T16:00:00.000Z',
    to: '2026-11-15T16:30:00.000Z',
    intensity: 172,
    index: 4,
    mix: null,
  });
  assert.equal(reading.mix.wind, 23.4);
  assert.equal(reading.mixAt, '2026-11-15T15:30:00.000Z');
});

test('a region and two postcodes: the mix of every slot, the API name', async () => {
  const api = createFakeApi();
  const london = await fetchZone(api.fetch, { kind: 'region', id: '13' }, START);
  assert.equal(london.name, 'London');
  assert.equal(london.slots.length, 96);
  assert.equal(Object.keys(london.slots[0].mix).length, 9);
  const rg10 = await fetchZone(api.fetch, { kind: 'postcode', id: 'RG10' }, START);
  assert.equal(rg10.name, 'South England');
  const eh1 = await fetchZone(api.fetch, { kind: 'postcode', id: 'EH1' }, START);
  assert.equal(eh1.name, 'South Scotland');
  assert.equal(eh1.slots[0].intensity, 0);
  assert.equal(eh1.slots[0].index, 1);
  assert.ok(
    api.calls.includes(`${API_URL}/regional/intensity/2026-11-15T16:20Z/fw48h/postcode/RG10`),
  );
});

test('an unknown postcode (200 null) and an unknown region (400) are UnknownZoneError', async () => {
  const api = createFakeApi();
  await assert.rejects(
    fetchZone(api.fetch, { kind: 'postcode', id: 'ZZ99' }, START),
    UnknownZoneError,
  );
  await assert.rejects(fetchZone(api.fetch, { kind: 'region', id: '99' }, START), UnknownZoneError);
});

test('a network cut and a server error are HttpError, never UnknownZoneError', async () => {
  const api = createFakeApi();
  api.down = true;
  await assert.rejects(fetchZone(api.fetch, { kind: 'postcode', id: 'RG10' }, START), (err) => {
    assert.ok(err instanceof HttpError && !(err instanceof UnknownZoneError));
    assert.match(err.message, /unreachable \(ENOTFOUND\)/);
    return true;
  });
  api.down = false;
  api.answer = () => json(503, {});
  const noWait = { retryDelayMs: 0 };
  await assert.rejects(fetchZone(api.fetch, { kind: 'national' }, START, noWait), /HTTP 503/);
  api.answer = () => json(500, {});
  await assert.rejects(
    fetchZone(api.fetch, { kind: 'region', id: '13' }, START, noWait),
    /HTTP 500/,
  );
});

test('a 5xx is tried once more: a passing 500 of the regional routes goes unseen', async () => {
  const api = createFakeApi();
  const answer = api.answer;
  let failures = 1;
  api.answer = (url) => (failures-- > 0 ? json(500, {}) : answer(url));
  const reading = await fetchZone(api.fetch, { kind: 'region', id: '13' }, START, {
    retryDelayMs: 0,
  });
  assert.equal(reading.name, 'London');
  assert.equal(api.calls.length, 2);
  // A 4xx is not tried again.
  api.calls.length = 0;
  await assert.rejects(fetchZone(api.fetch, { kind: 'region', id: '99' }, START));
  assert.equal(api.calls.length, 1);
});

test('the national mix is optional: the forecast alone still makes a reading', async () => {
  const api = createFakeApi();
  const answer = api.answer;
  api.answer = (url) => (url.endsWith('/generation') ? json(503, {}) : answer(url));
  const reading = await fetchZone(api.fetch, { kind: 'national' }, START, { retryDelayMs: 0 });
  assert.equal(reading.mix, null);
  assert.equal(reading.slots.length, 96);
});

test('apiTime and the slots: incomplete rows are dropped, actual wins over forecast', () => {
  assert.equal(apiTime(START), '2026-11-15T16:20Z');
  const parsed = parseSlots([
    {
      from: '2026-11-15T16:30Z',
      to: '2026-11-15T17:00Z',
      intensity: { forecast: 150, actual: null },
    },
    {
      from: '2026-11-15T16:00Z',
      to: '2026-11-15T16:30Z',
      intensity: { forecast: 150, actual: 140, index: 'low' },
    },
    { from: 'nope', to: '2026-11-15T17:00Z', intensity: { forecast: 1 } },
    { from: '2026-11-15T17:00Z', to: '2026-11-15T17:30Z', intensity: { forecast: null } },
  ]);
  assert.deepEqual(
    parsed.map((s) => [s.from, s.intensity, s.index]),
    [
      ['2026-11-15T16:00:00.000Z', 140, 2],
      ['2026-11-15T16:30:00.000Z', 150, null],
    ],
  );
});

test('the best window: lowest average, earliest on a tie, never past 24 hours', () => {
  const now = START;
  // 16:00 … : 200 200 100 100 50 50 50 50 ...
  const list = slots([200, 200, 100, 100, 50, 50, 50, 50, 300, 300]);
  assert.deepEqual(bestWindow(list, now, 60), {
    start: Date.UTC(2026, 10, 15, 18, 0),
    end: Date.UTC(2026, 10, 15, 19, 0),
    average: 50,
  });
  assert.equal(bestWindow(list, now, 180).average, 66.7);
  // Longer than the forecast: no window.
  assert.equal(bestWindow(list, now, 360), null);
  // A 24-hour horizon: a cheaper slot 25 hours ahead is ignored.
  const day = slots([...Array(48).fill(100), 10, 10]);
  assert.equal(bestWindow(day, now, 60).start, Date.UTC(2026, 10, 15, 16, 0));
  // The window starting now counts, and its start is in the past.
  assert.equal(minutesUntil(bestWindow(day, now, 60).start, now), 0);
});

test('the slot in progress, and a forecast with a hole or late', () => {
  const list = slots([100, 120, 130]);
  assert.equal(currentSlot(list, START).intensity, 100);
  assert.equal(currentSlot(list, START + SLOT_MS).intensity, 120);
  assert.equal(currentSlot(list, START + 3 * SLOT_MS), null);
  const holed = [list[0], list[2]];
  assert.equal(upcoming(holed, START).length, 1);
  assert.equal(currentSlot(slots([1], START + 2 * SLOT_MS), START), null);
});

test('the real London forecast: best 3 hours overnight', () => {
  const reading = parseSlots(LONDON_BODY.data.data);
  const best = bestWindow(reading, START, 180);
  assert.ok(best.start > START && best.start - START < 24 * 3600 * 1000);
  assert.ok(best.average < currentSlot(reading, START).intensity);
  const national = parseSlots(NATIONAL_BODY.data);
  assert.ok(bestWindow(national, START, 30).average <= bestWindow(national, START, 360).average);
});

test('postcodes: the outward part, upper case, five at most, the rest rejected', () => {
  assert.deepEqual(parsePostcodes('rg10 9ab, EH1;  SW1A 1AA\nrg10, M1'), {
    postcodes: ['RG10', 'EH1', 'SW1A', 'M1'],
    rejected: [],
  });
  assert.deepEqual(parsePostcodes('75001, hello, B1, B2, B3, B4, B5, B6').postcodes, [
    'B1',
    'B2',
    'B3',
    'B4',
    'B5',
  ]);
  assert.deepEqual(parsePostcodes('75001, hello').rejected, ['75001', 'HELLO']);
  const config = normalizeConfig({
    regions: ['13', '99', '1', '13'],
    postcodes: 'RG10',
    national: false,
  });
  assert.deepEqual(
    zonesOf(config).map((z) => z.key),
    ['region-1', 'region-13', 'postcode-rg10'],
  );
  assert.equal(normalizeConfig({}).national, true);
  assert.equal(normalizeConfig({}).bestWindowMinutes, 180);
  assert.equal(normalizeConfig({ best_window_minutes: '45' }).bestWindowMinutes, 180);
  assert.equal(normalizeConfig({ language: 'it' }).language, 'fr');
});

test('clock times in the Gladys time zone, summer time included; a postcode without its space', () => {
  assert.equal(clockTime(Date.UTC(2026, 10, 16, 3, 0), 'Europe/London'), '03:00');
  assert.equal(clockTime(Date.UTC(2026, 6, 16, 3, 0), 'Europe/London'), '04:00');
  assert.equal(clockTime(Date.UTC(2026, 6, 16, 3, 0), 'Europe/Paris'), '05:00');
  assert.deepEqual(parsePostcodes('RG109AB, sw1a1aa, EH1').postcodes, ['RG10', 'SW1A', 'EH1']);
});
