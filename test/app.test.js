// -----------------------------------------------------------------------------
// The integration against the SDK's fake Gladys and a fake API serving the
// real answers of 15/11/2026: devices, states, refresh pace, failures, the
// two triggers, the scene action, the timer and the logs.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ACTION_KEY,
  INDEX_TRIGGER_KEY,
  RETRY_MS,
  SCENE_ACTION_KEY,
  TICK_MS,
  UNKNOWN_RETRY_MS,
  WINDOW_TRIGGER_KEY,
} from '../src/app.js';
import { SLOT_MS } from '../src/forecast.js';
import { NATIONAL_BODY, START, createWorld, json, withSlot } from './helpers/world.js';

const NATIONAL = 'ext:test-integration:zone:national';
const RG10 = 'ext:test-integration:zone:postcode-rg10';
const EH1 = 'ext:test-integration:zone:postcode-eh1';

/** Capture what the loggers write, at a given LOG_LEVEL. */
function captureLogs(t, level) {
  const previous = process.env.LOG_LEVEL;
  process.env.LOG_LEVEL = level;
  t.after(() => {
    process.env.LOG_LEVEL = previous;
  });
  const lines = [];
  for (const stream of ['log', 'error', 'warn', 'info']) {
    t.mock.method(console, stream, (...args) => lines.push(args.map(String).join(' ')));
  }
  return lines;
}

test('one device per zone, the states of the added ones only', async (t) => {
  const world = await createWorld({ config: { postcodes: 'RG10', regions: ['13'] } });
  t.after(() => world.app.stop());
  assert.deepEqual(
    world.fake.discoveredDevices.map((d) => [d.external_id, d.name]),
    [
      [NATIONAL, 'Intensité carbone Grande-Bretagne'],
      ['ext:test-integration:zone:region-13', 'Intensité carbone Londres'],
      [RG10, 'Intensité carbone RG10'],
    ],
  );
  assert.equal(world.fake.lastState(`${NATIONAL}:intensity`), 172);
  assert.equal(world.fake.lastState(`${NATIONAL}:index`), 4);
  assert.equal(world.fake.lastState(`${NATIONAL}:index_label`), 'Élevé');
  assert.equal(world.fake.lastState(`${NATIONAL}:wind_share`), 23);
  assert.equal(world.fake.lastState(`${RG10}:intensity`), 227);
  assert.equal(world.fake.lastState(`${RG10}:gas_share`), 52);
  assert.equal(world.fake.lastState(`${RG10}:low_carbon_share`), 23.2);
  // The best 3 hours of the next 24, in the Gladys time zone (UTC in November).
  assert.match(world.fake.lastState(`${NATIONAL}:best_window_start`), /^0\d:\d0$/);
  assert.ok(world.fake.lastState(`${NATIONAL}:best_window_in`) > 0);
  assert.equal(world.fake.connectionStatus.connected, true);

  // A zone whose device is not added is not even read.
  const other = await createWorld({ config: { postcodes: 'RG10' }, created: false });
  t.after(() => other.app.stop());
  assert.equal(other.api.calls.length, 0);
  assert.equal(other.fake.states.length, 0);
});

test('one read per zone and half-hour slot, the slot moves on without a read', async (t) => {
  const world = await createWorld({ config: { national: false, postcodes: 'RG10' } });
  t.after(() => world.app.stop());
  assert.equal(world.api.count('RG10'), 1);
  for (let i = 0; i < 9; i += 1) {
    world.clock.advance(TICK_MS);
    await world.app.tick();
  }
  assert.equal(world.api.count('RG10'), 1, 'still 16:29: no new read');
  world.clock.advance(TICK_MS);
  await world.app.tick();
  assert.equal(world.api.count('RG10'), 2, '16:30: new slot, new read');
  assert.equal(world.fake.lastState(`${RG10}:intensity`), 229);

  // The API is down: the 48-hour forecast still gives the slot in progress.
  world.api.down = true;
  world.clock.advance(SLOT_MS);
  await world.app.tick();
  assert.equal(world.fake.lastState(`${RG10}:intensity`), 221);
});

test('a network cut: status with the four languages, retried every 5 minutes, then back', async (t) => {
  const world = await createWorld({ config: { national: false, postcodes: 'RG10' } });
  t.after(() => world.app.stop());
  world.api.down = true;
  world.clock.advance(SLOT_MS);
  await world.app.tick();
  const status = world.fake.connectionStatus;
  assert.equal(status.connected, false);
  assert.deepEqual(Object.keys(status.message).sort(), ['de', 'en', 'es', 'fr']);
  assert.match(status.message.en, /Cannot be read: RG10/);
  const calls = world.api.count('RG10');
  world.clock.advance(RETRY_MS - TICK_MS);
  await world.app.tick();
  assert.equal(world.api.count('RG10'), calls);
  world.clock.advance(TICK_MS);
  world.api.down = false;
  await world.app.tick();
  assert.equal(world.api.count('RG10'), calls + 1);
  assert.equal(world.fake.connectionStatus.connected, true);
});

test('an unknown postcode: said in the status and the action, asked again every 6 hours', async (t) => {
  const world = await createWorld({ config: { national: false, postcodes: 'ZZ99, banana' } });
  t.after(() => world.app.stop());
  assert.equal(world.fake.connectionStatus.connected, false);
  assert.match(world.fake.connectionStatus.message.fr, /Lecture impossible : ZZ99/);
  for (let i = 0; i < 12; i += 1) {
    world.clock.advance(SLOT_MS);
    await world.app.tick();
  }
  assert.equal(world.api.count('ZZ99'), 1 + Math.floor((12 * SLOT_MS) / UNKNOWN_RETRY_MS));
  const ack = await world.fake.action(ACTION_KEY, {});
  assert.equal(ack.success, true);
  assert.equal(
    ack.data.message.en,
    'ZZ99: unknown to the API · Ignored (not a UK postcode, or more than five): BANANA.',
  );
});

test('the test action reads every zone, in the four languages', async (t) => {
  const world = await createWorld({ config: { postcodes: 'RG10' } });
  t.after(() => world.app.stop());
  const ack = await world.fake.action(ACTION_KEY, {});
  assert.equal(
    ack.data.message.fr,
    'Grande-Bretagne : 172 g/kWh (élevé) · RG10 : 227 g/kWh (élevé)',
  );
  assert.match(ack.data.message.de, /Großbritannien: 172 g\/kWh \(hoch\)/);
  const none = await createWorld({ config: { national: false } });
  t.after(() => none.app.stop());
  assert.equal(none.fake.connectionStatus.connected, false);
  assert.match((await none.fake.action(ACTION_KEY, {})).data.message.en, /No zone is followed/);
});

test('"carbon index turns low": once per drop, not at start, not again after a restart', async (t) => {
  const config = { postcodes: '' };
  const first = await createWorld({ config });
  assert.equal(first.app.persisted.lastIndex.national, 4);
  assert.deepEqual(
    first.fake.sceneEvents.filter((e) => e.key === INDEX_TRIGGER_KEY),
    [],
  );
  // 16:30: NESO now says "low".
  first.api.bodies.national = withSlot(NATIONAL_BODY, '2026-11-15T16:30Z', {
    forecast: 90,
    index: 'low',
  });
  first.clock.advance(SLOT_MS);
  await first.app.tick();
  const events = first.fake.sceneEvents.filter((e) => e.key === INDEX_TRIGGER_KEY);
  assert.deepEqual(events, [
    {
      key: INDEX_TRIGGER_KEY,
      data: {
        device: NATIONAL,
        level: 'low',
        index: 2,
        index_label: 'Faible',
        intensity: 90,
        zone: 'Grande-Bretagne',
      },
    },
  ]);
  first.clock.advance(TICK_MS);
  await first.app.tick();
  await first.app.stop();

  // Restart in the same slot, same /data: not announced again.
  const second = await createWorld({
    config,
    api: first.api,
    clock: first.clock,
    dataDir: first.dataDir,
  });
  t.after(() => second.app.stop());
  assert.deepEqual(
    second.fake.sceneEvents.filter((e) => e.key === INDEX_TRIGGER_KEY),
    [],
  );
});

test('"best window starts": when the slot in progress opens it, once per window', async (t) => {
  // EH1 (South Scotland) is at 0 g/kWh: the window starting now is the best.
  const world = await createWorld({ config: { national: false, postcodes: 'EH1' } });
  const fired = () => world.fake.sceneEvents.filter((e) => e.key === WINDOW_TRIGGER_KEY);
  assert.deepEqual(fired(), [
    {
      key: WINDOW_TRIGGER_KEY,
      data: {
        device: EH1,
        duration_minutes: 180,
        average_intensity: 0,
        end_time: '19:00',
        zone: 'EH1',
      },
    },
  ]);
  for (let i = 0; i < 5; i += 1) {
    world.clock.advance(SLOT_MS);
    await world.app.tick();
  }
  assert.equal(fired().length, 1, 'inside the window: not again');
  await world.app.stop();
  const again = await createWorld({
    config: { national: false, postcodes: 'EH1' },
    clock: world.clock,
    dataDir: world.dataDir,
  });
  t.after(() => again.app.stop());
  assert.equal(
    again.fake.sceneEvents.filter((e) => e.key === WINDOW_TRIGGER_KEY).length,
    0,
    'a restart inside the window does not fire it again',
  );
});

test('"best window starts" for a real curve: fires at its start only', async (t) => {
  const world = await createWorld({ config: { postcodes: '' } });
  t.after(() => world.app.stop());
  const start = Date.parse(
    `2026-11-16T${world.fake.lastState(`${NATIONAL}:best_window_start`)}:00Z`,
  );
  const fired = () => world.fake.sceneEvents.filter((e) => e.key === WINDOW_TRIGGER_KEY);
  while (world.clock.now() + SLOT_MS <= start) {
    world.clock.advance(SLOT_MS);
    await world.app.tick();
    assert.equal(fired().length, 0, new Date(world.clock.now()).toISOString());
  }
  world.clock.advance(SLOT_MS);
  await world.app.tick();
  assert.equal(fired().length, 1);
  assert.equal(fired()[0].data.duration_minutes, 180);
});

test('a refused scene event is fired again at the next tick', async (t) => {
  const world = await createWorld({
    config: { national: false, postcodes: 'EH1' },
    connect: false,
  });
  t.after(() => world.app.stop());
  let refuse = true;
  const original = world.gladys.publishSceneEvent.bind(world.gladys);
  t.mock.method(world.gladys, 'publishSceneEvent', async (...args) => {
    if (refuse) {
      throw new Error('HTTP 429');
    }
    return original(...args);
  });
  await world.gladys.connect();
  assert.equal(world.fake.sceneEvents.length, 0);
  refuse = false;
  world.clock.advance(TICK_MS);
  await world.app.tick();
  assert.equal(world.fake.sceneEvents.length, 1);
});

test('the scene action finds the best window of the asked length', async (t) => {
  const world = await createWorld({ config: { postcodes: 'RG10' } });
  t.after(() => world.app.stop());
  const ack = await world.fake.sceneAction(SCENE_ACTION_KEY, { device: RG10, duration: '60' });
  assert.equal(ack.success, true, ack.error);
  const { start_time, end_time, minutes_until, average_intensity } = ack.data.outputs;
  assert.match(start_time, /^\d\d:\d\d$/);
  assert.match(end_time, /^\d\d:\d\d$/);
  assert.ok(minutes_until > 0 && minutes_until < 24 * 60);
  assert.ok(average_intensity < 227);
  const unknown = await world.fake.sceneAction(SCENE_ACTION_KEY, {
    device: 'ext:test-integration:zone:region-2',
    duration: '60',
  });
  assert.equal(unknown.success, false);
  assert.match(String(unknown.error?.message ?? unknown.error), /pas une zone/);
});

test('a device added: its states again now, and the widget refreshed', async (t) => {
  const world = await createWorld({ config: { postcodes: 'RG10' }, created: false });
  t.after(() => world.app.stop());
  assert.equal(world.api.calls.length, 0);
  const device = world.fake.discoveredDevices.find((d) => d.external_id === RG10);
  await world.fake.deviceCreated({ ...device });
  assert.equal(world.api.count('RG10'), 1);
  assert.equal(world.fake.lastState(`${RG10}:intensity`), 227);
  assert.ok(world.fake.widgetRefreshes.length >= 1);
  // Added again (update): every state published again, not only the changes.
  const before = world.fake.states.length;
  await world.fake.deviceUpdated({ ...device });
  assert.ok(world.fake.states.length - before >= 17);
});

test('the container reads on its own timer, without onPoll', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: START });
  const world = await createWorld({
    config: { national: false, postcodes: 'RG10' },
    timers: true,
    clock: { now: () => Date.now() },
  });
  t.after(() => world.app.stop());
  assert.equal(world.api.count('RG10'), 1);
  for (let i = 0; i < 10; i += 1) {
    t.mock.timers.tick(TICK_MS);
    // Let the tick's promises settle.
    for (let j = 0; j < 20; j += 1) {
      await new Promise((resolve) => setImmediate(resolve));
    }
  }
  assert.equal(world.api.count('RG10'), 2, 'a new read at 16:30');
});

test('the core may still call onPoll: a tick only when the timer missed one', async (t) => {
  const world = await createWorld({ config: { national: false, postcodes: 'RG10' } });
  t.after(() => world.app.stop());
  const [device] = world.fake.discoveredDevices;
  assert.equal(device.should_poll, false);
  assert.deepEqual(await world.fake.poll(device), { success: true });
  assert.equal(world.api.count('RG10'), 1);
  world.clock.advance(SLOT_MS);
  await world.fake.poll(device);
  assert.equal(world.api.count('RG10'), 2);
});

test('quiet logs: nothing at info in a normal cycle, one line per failure and recovery', async (t) => {
  const world = await createWorld({ config: { postcodes: 'RG10' } });
  t.after(() => world.app.stop());
  const lines = captureLogs(t, 'info');
  for (let i = 0; i < 4; i += 1) {
    world.clock.advance(SLOT_MS);
    await world.app.tick();
    await world.fake.widgetGet('forecast', { settings: {}, language: 'fr', units: 'metric' });
  }
  assert.ok(world.api.count('RG10') >= 5);
  assert.deepEqual(lines, []);

  world.api.answer = () => json(503, {});
  for (let i = 0; i < 4; i += 1) {
    world.clock.advance(SLOT_MS);
    await world.app.tick();
  }
  assert.equal(lines.length, 2, lines.join('\n'));
  assert.match(lines.join('\n'), /national cannot be read: .*HTTP 503/);
  assert.match(lines.join('\n'), /postcode-rg10 cannot be read: .*HTTP 503/);
});

test('a configuration change: zones removed are forgotten, zones added read at once', async (t) => {
  const world = await createWorld({ config: { postcodes: 'RG10' } });
  t.after(() => world.app.stop());
  assert.ok('postcode-rg10' in world.app.persisted.lastIndex);
  await world.fake.configUpdated({ national: true, postcodes: '', regions: ['13'] });
  assert.deepEqual(
    world.fake.discoveredDevices.map((d) => d.external_id),
    [NATIONAL, 'ext:test-integration:zone:region-13'],
  );
  assert.equal('postcode-rg10' in world.app.persisted.lastIndex, false);
  assert.equal(world.app.readings.has('postcode-rg10'), false);
  // The region's device is not added: not read until it is (or a widget shows it).
  assert.equal(world.api.count('regionid/13'), 0);
  assert.equal(world.fake.connectionStatus.connected, true);
});

test('a device deleted: its trigger memory goes, a later re-add does not fire a stale drop', async (t) => {
  const world = await createWorld({ config: { postcodes: '' } });
  t.after(() => world.app.stop());
  assert.equal(world.app.persisted.lastIndex.national, 4);
  const [device] = world.fake.discoveredDevices;
  await world.fake.deviceDeleted({ ...device });
  assert.equal(world.app.persisted.lastIndex.national, undefined);
  world.api.bodies.national = withSlot(NATIONAL_BODY, '2026-11-15T16:30Z', { index: 'low' });
  world.clock.advance(SLOT_MS);
  await world.fake.deviceCreated({ ...device });
  await world.app.tick();
  assert.equal(world.fake.sceneEvents.filter((e) => e.key === INDEX_TRIGGER_KEY).length, 0);
});

test('one zone failing among healthy ones: only it is named, the others go on', async (t) => {
  const world = await createWorld({ config: { postcodes: 'RG10, EH1' } });
  t.after(() => world.app.stop());
  const answer = world.api.answer;
  world.api.answer = (url) => (url.includes('EH1') ? json(503, {}) : answer(url));
  world.clock.advance(SLOT_MS);
  await world.app.tick();
  assert.deepEqual(world.fake.connectionStatus.message.en, 'Cannot be read: EH1.');
  assert.equal(world.fake.lastState(`${RG10}:intensity`), 229);
});

test('the best window countdown is rounded to 5 minutes, without history', async (t) => {
  const world = await createWorld({ config: { postcodes: '' } });
  t.after(() => world.app.stop());
  const feature = world.fake.discoveredDevices[0].features.find((f) =>
    f.external_id.endsWith(':best_window_in'),
  );
  assert.equal(feature.keep_history, false);
  assert.equal(world.fake.lastState(`${NATIONAL}:best_window_in`) % 5, 0);
  const before = world.fake.states.length;
  world.clock.advance(TICK_MS);
  await world.app.tick();
  world.clock.advance(TICK_MS);
  await world.app.tick();
  assert.ok(world.fake.states.length - before <= 1);
});
