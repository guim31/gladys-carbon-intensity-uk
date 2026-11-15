// -----------------------------------------------------------------------------
// The "Carbon intensity forecast" dashboard widget, for one zone:
//   heading   the name of the zone's device in Gladys
//   tiles     intensity now and index (colored like the index), start of the
//             best window (optional)
//   chart     the NESO forecast of the next 24 hours (inline series: the core
//             keeps no history of a forecast), a vertical line at the best
//             window, the "now" marker (Gladys 5.2.0)
//   status    the mix of the slot in progress, as text bars (optional)
//   caption   when NESO's forecast was read
// Budget (core): 8 components, 2 texts at most — this uses at most 7, 2 texts.
// -----------------------------------------------------------------------------

import { WIDGET_CHART_TYPES, WIDGET_COLORS } from '@gladysassistant/integration-sdk';
import { FUELS } from './api.js';
import { bestWindow, currentSlot, upcoming } from './forecast.js';
import { FUEL_TEXT, INDEX_TEXT, MESSAGES, TEXT, clockTime, pick } from './i18n.js';

export const WIDGET_KEY = 'forecast';

/** The data moves every half-hour: refetched every 5 minutes at most. */
export const WIDGET_TTL_SECONDS = 300;

const INDEX_COLORS = {
  1: WIDGET_COLORS.SUCCESS,
  2: WIDGET_COLORS.SUCCESS,
  3: WIDGET_COLORS.WARNING,
  4: WIDGET_COLORS.DANGER,
  5: WIDGET_COLORS.DANGER,
};

const FOSSIL = new Set(['gas', 'coal']);
const UNKNOWN = new Set(['imports', 'other']);

/** "███████░░░" for 68 %. */
export function bar(percent) {
  const cells = Math.max(0, Math.min(10, Math.round(percent / 10)));
  return '█'.repeat(cells) + '░'.repeat(10 - cells);
}

/** 180 → "3 h", 90 → "1 h 30", 30 → "30 min". */
export function durationText(minutes) {
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const rest = minutes % 60;
  return `${Math.floor(minutes / 60)} h${rest ? ` ${rest}` : ''}`;
}

/**
 * Build the widget content.
 * @param {object} options
 * @param {string | null} options.title the zone's device name, null without a zone
 * @param {object | null} options.reading the zone's latest reading (src/api.js)
 * @param {Record<string, number> | null} options.mix the mix to show
 * @param {number} options.now
 * @param {number} options.windowMinutes
 * @param {boolean} options.showBestWindow
 * @param {boolean} options.showMix
 * @param {boolean} options.failing the zone cannot be read right now
 * @param {string} options.language
 * @param {string} [options.timeZone]
 */
export function buildWidgetContent({
  title,
  reading,
  mix,
  now,
  windowMinutes,
  showBestWindow,
  showMix,
  failing,
  language,
  timeZone,
}) {
  const components = [];
  if (title === null) {
    components.push({ type: 'text', variant: 'body', text: pick(TEXT.noDevice, language) });
    return { ttl_seconds: WIDGET_TTL_SECONDS, components };
  }
  components.push({ type: 'text', variant: 'heading', text: title });
  const slot = reading ? currentSlot(reading.slots, now) : null;
  if (!slot) {
    components.push({
      type: 'text',
      variant: 'body',
      text: pick(failing ? TEXT.unreachable : TEXT.waiting, language),
    });
    return { ttl_seconds: WIDGET_TTL_SECONDS, components };
  }
  const color = INDEX_COLORS[slot.index];
  components.push({
    type: 'value',
    label: pick(TEXT.intensity, language),
    value: Math.round(slot.intensity),
    unit: 'g/kWh',
    icon: 'cloud',
    ...(color ? { color } : {}),
  });
  if (slot.index) {
    components.push({
      type: 'value',
      label: pick(TEXT.index, language),
      value: pick(INDEX_TEXT[slot.index], language),
      icon: 'activity',
      color,
    });
  }
  const best = showBestWindow ? bestWindow(reading.slots, now, windowMinutes) : null;
  if (best) {
    components.push({
      type: 'value',
      label: `${pick(TEXT.bestWindow, language)} (${durationText(windowMinutes)})`,
      value: best.start <= now ? pick(TEXT.now, language) : clockTime(best.start, timeZone),
      icon: 'clock',
      color: WIDGET_COLORS.SUCCESS,
    });
  }
  const next = upcoming(reading.slots, now);
  components.push({
    type: 'chart',
    series: [
      {
        name: pick(TEXT.chartSeries, language),
        points: next.map((s) => ({ t: s.from, v: Math.round(s.intensity) })),
      },
    ],
    chart_type: WIDGET_CHART_TYPES.AREA,
    title: pick(TEXT.chart, language),
    unit: 'g/kWh',
    now_marker: true,
    ...(best
      ? {
          annotations: [
            {
              t: new Date(best.start).toISOString(),
              label: `${pick(TEXT.bestMark, language)} ${Math.round(best.average)} g`,
              color: WIDGET_COLORS.SUCCESS,
            },
          ],
        }
      : {}),
  });
  if (showMix && mix) {
    const rows = FUELS.map((fuel) => ({ fuel, percent: mix[fuel] }))
      .filter((row) => row.percent >= 0.5)
      .sort((a, b) => b.percent - a.percent);
    if (rows.length > 0) {
      components.push({
        type: 'status',
        items: rows.map((row) => ({
          label: pick(FUEL_TEXT[row.fuel], language),
          value: `${bar(row.percent)} ${Math.round(row.percent)} %`,
          color: FOSSIL.has(row.fuel)
            ? WIDGET_COLORS.WARNING
            : UNKNOWN.has(row.fuel)
              ? WIDGET_COLORS.INFO
              : WIDGET_COLORS.SUCCESS,
        })),
      });
    }
  }
  if (reading.fetchedAt) {
    components.push({
      type: 'text',
      variant: 'caption',
      text: pick(MESSAGES.updatedAt(clockTime(reading.fetchedAt, timeZone)), language),
    });
  }
  return { ttl_seconds: WIDGET_TTL_SECONDS, components };
}
