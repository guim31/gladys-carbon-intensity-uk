// -----------------------------------------------------------------------------
// The integration, wired on a Gladys client (the real one in index.js, the
// SDK's fake Gladys in the tests).
//
// Refresh: the devices declare no poll frequency (the data moves every 30
// minutes, and the core does not poll external devices reliably, Gladys#3198).
// The container ticks every minute on its own timer. A tick
//   - reads a zone once per half-hour slot (and again 30 minutes after its
//     last read), when its device is added or a dashboard showed it in the
//     last hour; a failed read is retried after 5 minutes;
//   - publishes the states that changed: the slot in progress moves every
//     half-hour even without a new read, the 48-hour forecast covers it;
//   - fires the two scene triggers.
// The core's onPoll, if it ever calls it, only runs a tick when the timer
// missed one: it is the fallback.
//
// Triggers, remembered under /data so a restart does not fire them again:
//   - "carbon_index_low": the index of a zone goes from moderate or worse to
//     low or very low;
//   - "best_window_started": the slot in progress opens the best window of
//     the next 24 hours; once per window.
// -----------------------------------------------------------------------------

import { createLogger } from '@gladysassistant/integration-sdk';
import { UnknownZoneError, fetchZone } from './api.js';
import { WINDOW_MINUTES, normalizeConfig, zonesOf } from './config.js';
import { buildDevices, zoneIds, zoneMix, zoneStates } from './devices.js';
import { SLOT_MS, bestWindow, currentSlot, minutesUntil, slotStart } from './forecast.js';
import { INDEX_TEXT, MESSAGES, NAMES, TEXT, clockTime, joinTexts, pick, zoneName } from './i18n.js';
import { createIssueLog } from './issues.js';
import { Store } from './store.js';
import { WIDGET_KEY, buildWidgetContent } from './widgets.js';

const logger = createLogger({ name: 'carbon-intensity' });

export const TICK_MS = 60 * 1000;
export const RETRY_MS = 5 * 60 * 1000;
/** A postcode the API does not know: asked again every 6 hours only. */
export const UNKNOWN_RETRY_MS = 6 * 60 * 60 * 1000;
export const HEARTBEAT_MS = 6 * 60 * 60 * 1000;
/** A widget shown in the last hour keeps its zone read without the device. */
const WIDGET_INTEREST_MS = 60 * 60 * 1000;

export const ACTION_KEY = 'test_connection';
export const INDEX_TRIGGER_KEY = 'carbon_index_low';
export const WINDOW_TRIGGER_KEY = 'best_window_started';
export const SCENE_ACTION_KEY = 'find_best_window';
/** The index levels of the trigger: 1 very low, 2 low. */
export const LOW_LEVELS = { 1: 'very_low', 2: 'low' };

/**
 * @param {object} gladys GladysIntegration, or the SDK's fake Gladys
 * @param {object} [options]
 * @param {typeof fetch} [options.fetch]
 * @param {Store} [options.store]
 * @param {() => number} [options.now]
 * @param {boolean} [options.timers] run the minute timer
 * @param {string} [options.timeZone] for the clock times (TZ of Gladys by default)
 * @param {number} [options.retryDelayMs] before the second try after a 5xx
 */
export function registerHandlers(
  gladys,
  {
    fetch: fetchImpl = globalThis.fetch,
    store = new Store(),
    now = () => Date.now(),
    timers = true,
    timeZone,
    retryDelayMs,
  } = {},
) {
  let config = normalizeConfig(gladys.config ?? {});
  let zones = zonesOf(config);
  /** What /data keeps: `{ lastIndex: { zoneKey: 1-5 }, announcedUntil: { zoneKey: ms } }`. */
  let persisted = { lastIndex: {}, announcedUntil: {} };
  /** zone key → latest reading, `fetchZone` + `fetchedAt`. */
  const readings = new Map();
  /** zone key → time of the last attempt. */
  const attempts = new Map();
  const unknown = new Set();
  const widgetShownAt = new Map();
  let lastTickAt = -Infinity;
  let lastStatus = null;
  let reached = false;
  let timer = null;
  let stopped = false;
  let ticking = null;

  const apiIssues = createIssueLog(logger.child('api'));
  const gladysIssues = createIssueLog(logger);

  const ready = store.load().then((data) => {
    persisted = {
      lastIndex: data.lastIndex && typeof data.lastIndex === 'object' ? data.lastIndex : {},
      announcedUntil:
        data.announcedUntil && typeof data.announcedUntil === 'object' ? data.announcedUntil : {},
    };
  });

  const isCreated = (zone) =>
    (gladys.devices ?? []).some((device) => device.external_id === zoneIds(gladys, zone).device);
  const zoneOfDevice = (externalId) =>
    zones.find((zone) => zoneIds(gladys, zone).device === externalId) ?? null;
  const isFailing = (zone) => apiIssues.isFailing(zone.key);
  const stateOptions = () => ({
    now: now(),
    language: config.language,
    windowMinutes: config.bestWindowMinutes,
    timeZone,
  });

  // --- Reading the API ------------------------------------------------------

  /** Read one zone now; true when it answered. */
  async function refreshZone(zone) {
    attempts.set(zone.key, now());
    try {
      const reading = await fetchZone(fetchImpl, zone, now(), { retryDelayMs });
      if (reading.slots.length === 0) {
        throw new Error('the API answered an empty forecast');
      }
      readings.set(zone.key, { ...reading, fetchedAt: now() });
      unknown.delete(zone.key);
      if (!reached) {
        reached = true;
        logger.info('Carbon Intensity API reachable');
      }
      apiIssues.ok(zone.key, `${zone.key}: the Carbon Intensity API answers again`);
      logger.debug(
        `${zone.key}: ${reading.slots.length} slots, ${reading.slots[0].intensity} g/kWh`,
      );
      return true;
    } catch (err) {
      if (err instanceof UnknownZoneError) {
        unknown.add(zone.key);
      }
      apiIssues.fail(zone.key, `${zone.key} cannot be read: ${err.message}`);
      return false;
    }
  }

  function isDue(zone) {
    const attempt = attempts.get(zone.key) ?? -Infinity;
    if (unknown.has(zone.key)) {
      return now() - attempt >= UNKNOWN_RETRY_MS;
    }
    if (isFailing(zone) || !readings.has(zone.key)) {
      return now() - attempt >= RETRY_MS;
    }
    const { fetchedAt } = readings.get(zone.key);
    // A new slot began, or the forecast is 30 minutes old (NESO revises it).
    return slotStart(now()) > slotStart(fetchedAt) || now() - fetchedAt >= SLOT_MS;
  }

  const wanted = (zone) =>
    isCreated(zone) || now() - (widgetShownAt.get(zone.key) ?? -Infinity) < WIDGET_INTEREST_MS;

  // --- States and triggers ----------------------------------------------------

  async function publishStates() {
    const options = stateOptions();
    const states = zones
      .filter(isCreated)
      .flatMap((zone) => zoneStates(gladys, zone, readings.get(zone.key), options));
    if (states.length === 0) {
      return;
    }
    try {
      const { count } = await gladys.publishChangedStates(states, { heartbeat: HEARTBEAT_MS });
      if (count > 0) {
        logger.debug(`${count} state(s) published`);
      }
      gladysIssues.ok('states', 'States accepted by Gladys again');
    } catch (err) {
      gladysIssues.fail('states', `States not accepted by Gladys: ${err.message}`);
    }
  }

  async function fireTriggers() {
    let changed = false;
    for (const zone of zones.filter(isCreated)) {
      const reading = readings.get(zone.key);
      const slot = reading ? currentSlot(reading.slots, now()) : null;
      if (!slot) {
        continue;
      }
      const device = zoneIds(gladys, zone).device;
      const name = pick(zoneName(zone), config.language);
      if (slot.index) {
        const previous = persisted.lastIndex[zone.key];
        let remember = true;
        if (previous >= 3 && slot.index <= 2) {
          remember = await fire(INDEX_TRIGGER_KEY, {
            device,
            level: LOW_LEVELS[slot.index],
            index: slot.index,
            index_label: pick(INDEX_TEXT[slot.index], config.language),
            intensity: Math.round(slot.intensity),
            zone: name,
          });
        }
        if (remember && previous !== slot.index) {
          persisted.lastIndex[zone.key] = slot.index;
          changed = true;
        }
      }
      const best = bestWindow(reading.slots, now(), config.bestWindowMinutes);
      const until = persisted.announcedUntil[zone.key] ?? 0;
      if (best && best.start === slotStart(now()) && until <= now()) {
        const fired = await fire(WINDOW_TRIGGER_KEY, {
          device,
          duration_minutes: config.bestWindowMinutes,
          average_intensity: Math.round(best.average),
          end_time: clockTime(best.end, timeZone),
          zone: name,
        });
        if (fired) {
          persisted.announcedUntil[zone.key] = best.end;
          changed = true;
          logger.info(`${zone.key}: best window started, until ${clockTime(best.end, timeZone)}`);
        }
      }
    }
    if (changed) {
      store.save(persisted);
    }
  }

  /** Fire one trigger; false when Gladys refused it (fired again next tick). */
  async function fire(key, data) {
    try {
      await gladys.publishSceneEvent(key, data);
      return true;
    } catch (err) {
      gladysIssues.fail(`scene-${key}`, `Scene event ${key} not sent to Gladys: ${err.message}`);
      return false;
    }
  }

  /** The application status of the Configuration screen, sent on change only. */
  async function reportStatus() {
    let status = { connected: true };
    const failing = zones.filter((zone) => isFailing(zone) && wanted(zone));
    if (zones.length === 0) {
      status = { connected: false, message: TEXT.noZone };
    } else if (failing.length > 0) {
      status = { connected: false, message: MESSAGES.statusFailing(failing.map(zoneName)) };
    }
    const key = JSON.stringify(status);
    if (key === lastStatus) {
      return;
    }
    try {
      await gladys.setConnectionStatus(status.connected, status.message);
      lastStatus = key;
    } catch (err) {
      logger.debug(`Connection status not sent: ${err.message}`);
    }
  }

  // --- The tick ---------------------------------------------------------------

  /**
   * Read what is due, publish what changed, fire the triggers. One tick at a
   * time: a second caller waits for the one in progress.
   * @param {object} [options]
   * @param {boolean} [options.force] read every wanted zone now
   */
  async function tick({ force = false } = {}) {
    while (force && ticking) {
      await ticking.catch(() => {});
    }
    if (ticking) {
      return ticking;
    }
    ticking = (async () => {
      lastTickAt = now();
      if (gladys.connected === false) {
        logger.debug('Gladys unreachable: tick skipped');
        return;
      }
      let fresh = false;
      for (const zone of zones) {
        if (wanted(zone) && (force || isDue(zone))) {
          fresh = (await refreshZone(zone)) || fresh;
        }
      }
      await publishStates();
      await fireTriggers();
      await reportStatus();
      if (fresh) {
        gladys.requestWidgetRefresh(WIDGET_KEY);
      }
    })().finally(() => {
      ticking = null;
    });
    return ticking;
  }

  function schedule() {
    clearTimeout(timer);
    timer = null;
    if (!timers || stopped) {
      return;
    }
    timer = setTimeout(async () => {
      timer = null;
      try {
        await tick();
      } catch (err) {
        logger.error(`Refresh failed (${err.message})`);
      } finally {
        schedule();
      }
    }, TICK_MS);
  }

  /** (Re)start: publish the devices, read everything wanted, then every minute. */
  async function start() {
    await ready;
    stopped = false;
    lastStatus = null;
    zones = zonesOf(config);
    // Readings of zones no longer configured are dropped.
    for (const key of readings.keys()) {
      if (!zones.some((zone) => zone.key === key)) {
        readings.delete(key);
      }
    }
    attempts.clear();
    unknown.clear();
    if (config.rejectedPostcodes.length > 0) {
      logger.warn(`Ignored, not a UK postcode: ${config.rejectedPostcodes.join(', ')}`);
    }
    try {
      await gladys.publishDiscoveredDevices(buildDevices(gladys, config));
    } catch (err) {
      logger.error(`Publishing the devices failed: ${err.message}`);
    }
    logger.info(
      `Following ${zones.length} zone(s): ${zones.map((z) => z.key).join(', ') || 'none'}`,
    );
    schedule();
    await tick({ force: true });
  }

  /** The reading of a zone, read now when it is due (action, widget). */
  async function readingOf(zone) {
    if (isDue(zone)) {
      await refreshZone(zone);
    }
    return readings.get(zone.key) ?? null;
  }

  // --- Handlers ---------------------------------------------------------------

  gladys.onScanRequest(async () => {
    await gladys.publishDiscoveredDevices(buildDevices(gladys, config));
  });

  gladys.onPoll(async () => {
    // Fallback of the timer: a tick runs only when the timer has not ticked
    // for most of a minute.
    if (now() - lastTickAt < TICK_MS * 0.9) {
      return;
    }
    await tick();
  });

  // A device just added: its states again now (the core dropped the ones it
  // received before the feature existed), and the widget can show it.
  const onDeviceAdded = async (device) => {
    const zone = zoneOfDevice(device.external_id);
    if (zone && !readings.has(zone.key)) {
      await refreshZone(zone);
    }
    await publishStates();
    gladys.requestWidgetRefresh(WIDGET_KEY);
  };
  gladys.onDeviceCreated(onDeviceAdded);
  gladys.onDeviceUpdated(onDeviceAdded);
  gladys.onDeviceDeleted(async () => {
    gladys.requestWidgetRefresh(WIDGET_KEY);
  });

  gladys.onAction(ACTION_KEY, async () => {
    logger.info('Action: test the Carbon Intensity API');
    const parts = [];
    if (zones.length === 0) {
      parts.push(TEXT.noZone);
    }
    // In parallel: a zone that times out must not make the others wait.
    const answered = await Promise.all(zones.map((zone) => refreshZone(zone)));
    zones.forEach((zone, i) => {
      if (answered[i]) {
        const slot = currentSlot(readings.get(zone.key).slots, now());
        parts.push(MESSAGES.zoneOk(zoneName(zone), slot?.intensity ?? 0, slot?.index));
      } else {
        parts.push(
          unknown.has(zone.key)
            ? MESSAGES.zoneUnknown(zoneName(zone))
            : MESSAGES.zoneDown(zoneName(zone)),
        );
      }
    });
    if (config.rejectedPostcodes.length > 0) {
      parts.push(MESSAGES.rejectedPostcodes(config.rejectedPostcodes));
    }
    await publishStates();
    await reportStatus();
    return joinTexts(' · ', ...parts);
  });

  gladys.onSceneAction(SCENE_ACTION_KEY, async (fields) => {
    const zone = zoneOfDevice(fields.device);
    if (!zone) {
      throw new Error(pick(TEXT.unknownDevice, config.language));
    }
    const minutes = WINDOW_MINUTES.includes(String(fields.duration))
      ? Number(fields.duration)
      : config.bestWindowMinutes;
    const reading = await readingOf(zone);
    const best = reading ? bestWindow(reading.slots, now(), minutes) : null;
    if (!best) {
      throw new Error(pick(TEXT.noForecast, config.language));
    }
    logger.info(`Scene action: best ${minutes}-minute window of ${zone.key} asked`);
    return {
      start_time: clockTime(best.start, timeZone),
      end_time: clockTime(best.end, timeZone),
      minutes_until: minutesUntil(best.start, now()),
      average_intensity: Math.round(best.average),
    };
  });

  gladys.onWidgetGet(WIDGET_KEY, async ({ settings = {}, language }) => {
    const zone = settings.zone ? zoneOfDevice(settings.zone) : (zones[0] ?? null);
    if (!zone) {
      return buildWidgetContent({ title: null, language });
    }
    widgetShownAt.set(zone.key, now());
    const reading = await readingOf(zone);
    const ids = zoneIds(gladys, zone);
    const device = (gladys.devices ?? []).find((d) => d.external_id === ids.device);
    const names = NAMES[language] ?? NAMES.en;
    return buildWidgetContent({
      title: device?.name ?? `${names.device} ${pick(zoneName(zone), language)}`,
      reading,
      mix: zoneMix(reading, now()),
      now: now(),
      windowMinutes: config.bestWindowMinutes,
      showBestWindow: settings.show_best_window !== false && settings.show_best_window !== 'false',
      showMix: settings.show_mix !== false && settings.show_mix !== 'false',
      failing: isFailing(zone),
      language,
      timeZone,
    });
  });

  gladys.onConfigUpdated(async (raw) => {
    config = normalizeConfig(raw);
    logger.info('New configuration received');
    await start();
  });

  gladys.on('connected', async () => {
    try {
      config = normalizeConfig(await gladys.getConfig());
      await start();
    } catch (err) {
      logger.error(`Post-connection initialization failed: ${err.message}`);
      await gladys.setConnectionStatus(false, TEXT.initFailed).catch(() => {});
    }
  });

  return {
    ready,
    tick,
    /** For the tests: what the integration holds. */
    readings,
    get persisted() {
      return persisted;
    },
    /** Stop the timer and wait for the last write under /data. */
    async stop() {
      stopped = true;
      clearTimeout(timer);
      timer = null;
      await ticking?.catch(() => {});
      await store.flush();
    },
  };
}
