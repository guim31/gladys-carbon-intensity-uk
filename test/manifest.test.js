// -----------------------------------------------------------------------------
// Consistency checks between `gladys-assistant-integration.json` and the code.
// The manifest is validated by the store indexer, but nothing there can know
// which handlers the code actually registers — these tests keep both in sync.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  ACTION_KEY,
  INDEX_TRIGGER_KEY,
  LOW_LEVELS,
  SCENE_ACTION_KEY,
  WINDOW_TRIGGER_KEY,
} from '../src/app.js';
import { DEFAULT_CONFIG, LANGUAGES, REGION_IDS, WINDOW_MINUTES } from '../src/config.js';
import { REGION_NAMES } from '../src/i18n.js';
import { WIDGET_KEY } from '../src/widgets.js';
import { NATIONAL_BODY, createWorld, withSlot } from './helpers/world.js';

const manifest = JSON.parse(
  await readFile(new URL('../gladys-assistant-integration.json', import.meta.url), 'utf8'),
);
const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));

const keysOf = (list) => (list ?? []).map((entry) => entry.key);
const field = (key) => manifest.config_schema.find((f) => f.key === key);

function minGladysVersion() {
  const match = manifest.gladys_version.match(/>=\s*(\d+)\.(\d+)\.(\d+)/);
  assert.ok(match, 'gladys_version must declare a minimum version');
  return match.slice(1).map(Number);
}

test('identity: name, image, cover, transport, energy category, Great Britain', () => {
  assert.equal(manifest.name, 'Carbon Intensity UK');
  assert.equal(manifest.type, 'device');
  assert.match(manifest.docker_image, /^ghcr\.io\/guim31\/gladys-carbon-intensity-uk:/);
  assert.equal(
    manifest.cover_image,
    'https://raw.githubusercontent.com/guim31/gladys-carbon-intensity-uk/main/cover.png',
  );
  assert.deepEqual(manifest.transports, ['local']);
  assert.deepEqual(manifest.categories, ['energy']);
  assert.deepEqual(manifest.countries, ['GB']);
  assert.equal(manifest.network_discovery, undefined);
});

test('the manifest version is the package version, and the image is tagged with it', () => {
  assert.equal(manifest.version, pkg.version, 'manifest version must match package.json');
  assert.ok(manifest.docker_image.endsWith(`:${manifest.version}`));
});

test('Gladys >= 5.3.0: countries (5.3.0), chart annotations and now marker (5.2.0)', () => {
  assert.deepEqual(minGladysVersion(), [5, 3, 0]);
});

test('the catalog description holds 10 to 100 characters per language', () => {
  for (const [lang, text] of Object.entries(manifest.description)) {
    assert.ok(text.length >= 10 && text.length <= 100, `description.${lang}: ${text.length}`);
  }
});

test('config_schema defaults stay consistent with DEFAULT_CONFIG', () => {
  const valued = manifest.config_schema.filter((f) => f.type !== 'section');
  assert.deepEqual(keysOf(valued).sort(), Object.keys(DEFAULT_CONFIG).sort());
  for (const f of valued) {
    if (f.default !== undefined) {
      assert.equal(DEFAULT_CONFIG[f.key], f.default, f.key);
    }
  }
  assert.deepEqual(
    field('language').options.map((o) => o.value),
    LANGUAGES,
  );
  assert.deepEqual(
    field('regions').options.map((o) => o.value),
    REGION_IDS,
  );
  // The region labels of the configuration are the device names (England,
  // Scotland and Wales say "whole" there, to tell them from their regions).
  for (const option of field('regions').options.slice(0, 14)) {
    assert.deepEqual(option.label, REGION_NAMES[option.value], option.value);
  }
  assert.deepEqual(
    field('best_window_minutes').options.map((o) => o.value),
    WINDOW_MINUTES,
  );
});

test('section fields are purely presentational, their links https, NESO named', () => {
  for (const section of manifest.config_schema.filter((f) => f.type === 'section')) {
    assert.equal(section.required, undefined);
    assert.equal(section.default, undefined);
    for (const link of section.links ?? []) {
      assert.match(link.url, /^https:\/\//);
    }
  }
  assert.match(field('intro').description.en, /Not affiliated with NESO/);
  assert.match(field('intro').description.fr, /Sans lien avec NESO/);
});

test('the manifest action has a handler and needs no field', async (t) => {
  assert.deepEqual(keysOf(manifest.actions), [ACTION_KEY]);
  assert.equal(manifest.actions[0].fields, undefined);
  const world = await createWorld();
  t.after(() => world.app.stop());
  const ack = await world.fake.action(ACTION_KEY, {});
  assert.equal(ack.success, true, ack.error);
});

test('scene keys and the widget key are the ones of the code', () => {
  assert.deepEqual(keysOf(manifest.scene_triggers), [INDEX_TRIGGER_KEY, WINDOW_TRIGGER_KEY]);
  assert.deepEqual(keysOf(manifest.scene_actions), [SCENE_ACTION_KEY]);
  assert.deepEqual(keysOf(manifest.widgets), [WIDGET_KEY]);
  const widgetSettings = manifest.widgets[0].settings;
  assert.deepEqual(keysOf(widgetSettings), ['zone', 'show_best_window', 'show_mix']);
  assert.equal(widgetSettings[0].source, 'devices');
  const [action] = manifest.scene_actions;
  assert.deepEqual(keysOf(action.fields), ['device', 'duration']);
  assert.deepEqual(
    action.fields[1].options.map((o) => o.value),
    WINDOW_MINUTES,
  );
});

/** Every key sent is a filter or a variable, every variable is sent with its type. */
function assertEventMatches(trigger, event) {
  const declared = new Set([...keysOf(trigger.fields), ...keysOf(trigger.variables)]);
  assert.deepEqual(
    Object.keys(event.data).filter((key) => !declared.has(key)),
    [],
  );
  for (const variable of trigger.variables) {
    assert.equal(typeof event.data[variable.key], variable.type, variable.key);
  }
  for (const filter of trigger.fields) {
    assert.ok(filter.key in event.data, filter.key);
  }
}

test('the triggers send the keys their filters and variables declare', async (t) => {
  const world = await createWorld({ config: { postcodes: 'EH1' } });
  t.after(() => world.app.stop());
  world.api.bodies.national = withSlot(NATIONAL_BODY, '2026-11-15T16:30Z', {
    forecast: 40,
    index: 'very low',
  });
  world.clock.advance(30 * 60 * 1000);
  await world.app.tick();
  const [indexTrigger, windowTrigger] = manifest.scene_triggers;
  const indexEvent = world.fake.sceneEvents.find((e) => e.key === INDEX_TRIGGER_KEY);
  assertEventMatches(indexTrigger, indexEvent);
  assert.deepEqual(
    indexTrigger.fields.find((f) => f.key === 'level').options.map((o) => o.value),
    Object.values(LOW_LEVELS),
  );
  assert.equal(indexEvent.data.level, 'very_low');
  const windowEvent = world.fake.sceneEvents.find((e) => e.key === WINDOW_TRIGGER_KEY);
  assertEventMatches(windowTrigger, windowEvent);
});
