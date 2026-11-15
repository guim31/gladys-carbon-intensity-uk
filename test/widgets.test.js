// -----------------------------------------------------------------------------
// The "Carbon intensity forecast" widget: a content the core renders exactly
// as sent (validateWidgetContent), within its budget, in the four languages.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateWidgetContent } from '@gladysassistant/integration-sdk';
import { WIDGET_KEY, bar, buildWidgetContent, durationText } from '../src/widgets.js';
import { createWorld } from './helpers/world.js';

const RG10 = 'ext:test-integration:zone:postcode-rg10';

const get = (world, settings = {}, language = 'fr') =>
  world.fake.widgetGet(WIDGET_KEY, { settings, language, units: 'metric' });

test('the widget: tiles, the 24-hour forecast with the best window, the mix', async (t) => {
  const world = await createWorld({ config: { postcodes: 'RG10' } });
  t.after(() => world.app.stop());
  const ack = await get(world, { zone: RG10 });
  assert.equal(ack.success, true, ack.error);
  const content = ack.data.content;
  assert.deepEqual(validateWidgetContent(content), []);
  assert.ok(content.components.length <= 8);
  assert.ok(content.components.filter((c) => c.type === 'text').length <= 2);

  // The name the user gave the device in Gladys.
  assert.deepEqual(content.components[0], {
    type: 'text',
    variant: 'heading',
    text: 'Device postcode-rg10',
  });
  const tiles = content.components.filter((c) => c.type === 'value');
  assert.deepEqual(
    tiles.slice(0, 2).map((c) => [c.label, c.value, c.color]),
    [
      ['Maintenant', 227, 'danger'],
      ['Indice', 'Élevé', 'danger'],
    ],
  );
  assert.equal(tiles[2].label, 'Meilleur créneau (3 h)');
  assert.match(tiles[2].value, /^\d\d:\d\d$/);

  const chart = content.components.find((c) => c.type === 'chart');
  assert.equal(chart.series[0].points.length, 48);
  assert.equal(chart.series[0].points[0].t, '2026-11-15T16:00:00.000Z');
  assert.equal(chart.now_marker, true);
  assert.equal(chart.annotations.length, 1);
  assert.match(chart.annotations[0].label, /^Meilleur \d+ g$/);

  const status = content.components.find((c) => c.type === 'status');
  assert.equal(status.items[0].label, 'Gaz');
  assert.equal(status.items[0].value, '█████░░░░░ 52 %');
  assert.match(content.components.at(-1).text, /^Prévision NESO de 16:20$/);
});

test('the settings hide the best window and the mix', async (t) => {
  const world = await createWorld({ config: { postcodes: 'RG10' } });
  t.after(() => world.app.stop());
  const { content } = (await get(world, { zone: RG10, show_best_window: false, show_mix: false }))
    .data;
  assert.deepEqual(validateWidgetContent(content), []);
  assert.equal(content.components.filter((c) => c.type === 'value').length, 2);
  assert.equal(content.components.find((c) => c.type === 'chart').annotations, undefined);
  assert.equal(
    content.components.find((c) => c.type === 'status'),
    undefined,
  );
});

test('the widget in the four languages, and without a zone or without data', async (t) => {
  const world = await createWorld({ config: { postcodes: '' } });
  t.after(() => world.app.stop());
  for (const language of ['en', 'fr', 'de', 'es']) {
    const { content } = (await get(world, {}, language)).data;
    assert.deepEqual(validateWidgetContent(content), [], language);
  }
  assert.equal((await get(world, {}, 'de')).data.content.components[1].label, 'Jetzt');

  const none = await createWorld({ config: { national: false } });
  t.after(() => none.app.stop());
  assert.match((await get(none)).data.content.components[0].text, /Choisissez une zone/);

  const down = await createWorld({ config: { postcodes: '' } });
  t.after(() => down.app.stop());
  down.api.down = true;
  down.app.readings.clear();
  down.clock.advance(10 * 60 * 1000);
  const { content } = (await get(down, {}, 'en')).data;
  assert.deepEqual(validateWidgetContent(content), []);
  assert.match(content.components[1].text, /cannot be reached/);
});

test('a widget shown keeps its zone read even without the device', async (t) => {
  const world = await createWorld({ config: { postcodes: 'RG10' }, created: false });
  t.after(() => world.app.stop());
  assert.equal(world.api.calls.length, 0);
  await get(world, {});
  assert.equal(world.api.count('/intensity/'), 1);
  const content = buildWidgetContent({ title: null, language: 'es' });
  assert.match(content.components[0].text, /Elija una zona/);
});

test('bars and durations', () => {
  assert.equal(bar(68), '███████░░░');
  assert.equal(bar(0), '░░░░░░░░░░');
  assert.equal(bar(120), '██████████');
  assert.equal(durationText(30), '30 min');
  assert.equal(durationText(90), '1 h 30');
  assert.equal(durationText(180), '3 h');
});
