// -----------------------------------------------------------------------------
// Every text the integration shows, in the four languages of the Gladys
// interface (en, fr, de, es). German says "du", Spanish says "usted", like the
// rest of guim31's integrations. Brands and place names of the API stay as
// they are, except the three nations and London, which every language names.
//
//   - NAMES    : device and feature names, written once in the language of
//                the configuration (Gladys freezes them when a device is added);
//   - TEXT     : the fixed texts (widget, configuration screen, actions);
//   - MESSAGES : the texts built from a value.
//
// test/i18n.test.js checks that every entry carries exactly the four
// languages, with no empty text and no polite German.
// -----------------------------------------------------------------------------

import { LANGUAGES } from './config.js';

export { LANGUAGES };

/** A multi-language object → the text of one language (English as fallback). */
export function pick(text, language) {
  return text[language] ?? text.en;
}

/** Device and feature names, by language then key. */
export const NAMES = {
  en: {
    device: 'Carbon intensity',
    national: 'Great Britain',
    intensity: 'Carbon intensity',
    index: 'Carbon index (1 to 5)',
    index_label: 'Carbon index',
    low_carbon_share: 'Low-carbon share',
    renewable_share: 'Renewable share',
    wind_share: 'Wind share',
    solar_share: 'Solar share',
    nuclear_share: 'Nuclear share',
    gas_share: 'Gas share',
    imports_share: 'Imports share',
    biomass_share: 'Biomass share',
    hydro_share: 'Hydro share',
    coal_share: 'Coal share',
    other_share: 'Other sources share',
    best_window_start: 'Best window start',
    best_window_in: 'Best window starts in',
    best_window_intensity: 'Best window intensity',
  },
  fr: {
    device: 'Intensité carbone',
    national: 'Grande-Bretagne',
    intensity: 'Intensité carbone',
    index: 'Indice carbone (1 à 5)',
    index_label: 'Indice carbone',
    low_carbon_share: 'Part bas carbone',
    renewable_share: 'Part renouvelable',
    wind_share: "Part de l'éolien",
    solar_share: 'Part du solaire',
    nuclear_share: 'Part du nucléaire',
    gas_share: 'Part du gaz',
    imports_share: 'Part des importations',
    biomass_share: 'Part de la biomasse',
    hydro_share: "Part de l'hydraulique",
    coal_share: 'Part du charbon',
    other_share: 'Part des autres sources',
    best_window_start: 'Début du meilleur créneau',
    best_window_in: 'Meilleur créneau dans',
    best_window_intensity: 'Intensité du meilleur créneau',
  },
  de: {
    device: 'CO₂-Intensität',
    national: 'Großbritannien',
    intensity: 'CO₂-Intensität',
    index: 'CO₂-Index (1 bis 5)',
    index_label: 'CO₂-Index',
    low_carbon_share: 'CO₂-armer Anteil',
    renewable_share: 'Erneuerbarer Anteil',
    wind_share: 'Windanteil',
    solar_share: 'Solaranteil',
    nuclear_share: 'Kernkraftanteil',
    gas_share: 'Gasanteil',
    imports_share: 'Importanteil',
    biomass_share: 'Biomasseanteil',
    hydro_share: 'Wasserkraftanteil',
    coal_share: 'Kohleanteil',
    other_share: 'Anteil sonstiger Quellen',
    best_window_start: 'Beginn des besten Zeitfensters',
    best_window_in: 'Bestes Zeitfenster in',
    best_window_intensity: 'Intensität des besten Fensters',
  },
  es: {
    device: 'Intensidad de carbono',
    national: 'Gran Bretaña',
    intensity: 'Intensidad de carbono',
    index: 'Índice de carbono (1 a 5)',
    index_label: 'Índice de carbono',
    low_carbon_share: 'Cuota baja en carbono',
    renewable_share: 'Cuota renovable',
    wind_share: 'Cuota eólica',
    solar_share: 'Cuota solar',
    nuclear_share: 'Cuota nuclear',
    gas_share: 'Cuota de gas',
    imports_share: 'Cuota de importaciones',
    biomass_share: 'Cuota de biomasa',
    hydro_share: 'Cuota hidráulica',
    coal_share: 'Cuota de carbón',
    other_share: 'Cuota de otras fuentes',
    best_window_start: 'Inicio de la mejor franja',
    best_window_in: 'Mejor franja dentro de',
    best_window_intensity: 'Intensidad de la mejor franja',
  },
};

/** The regions of the API, by id: the configuration list and the device names. */
export const REGION_NAMES = {
  1: { en: 'North Scotland', fr: 'Nord de l’Écosse', de: 'Nordschottland', es: 'Norte de Escocia' },
  2: { en: 'South Scotland', fr: 'Sud de l’Écosse', de: 'Südschottland', es: 'Sur de Escocia' },
  3: {
    en: 'North West England',
    fr: 'Nord-Ouest de l’Angleterre',
    de: 'Nordwestengland',
    es: 'Noroeste de Inglaterra',
  },
  4: {
    en: 'North East England',
    fr: 'Nord-Est de l’Angleterre',
    de: 'Nordostengland',
    es: 'Noreste de Inglaterra',
  },
  5: { en: 'Yorkshire', fr: 'Yorkshire', de: 'Yorkshire', es: 'Yorkshire' },
  6: {
    en: 'North Wales & Merseyside',
    fr: 'Nord du pays de Galles et Merseyside',
    de: 'Nordwales und Merseyside',
    es: 'Norte de Gales y Merseyside',
  },
  7: { en: 'South Wales', fr: 'Sud du pays de Galles', de: 'Südwales', es: 'Sur de Gales' },
  8: { en: 'West Midlands', fr: 'West Midlands', de: 'West Midlands', es: 'West Midlands' },
  9: { en: 'East Midlands', fr: 'East Midlands', de: 'East Midlands', es: 'East Midlands' },
  10: {
    en: 'East England',
    fr: 'Est de l’Angleterre',
    de: 'Ostengland',
    es: 'Este de Inglaterra',
  },
  11: {
    en: 'South West England',
    fr: 'Sud-Ouest de l’Angleterre',
    de: 'Südwestengland',
    es: 'Suroeste de Inglaterra',
  },
  12: {
    en: 'South England',
    fr: 'Sud de l’Angleterre',
    de: 'Südengland',
    es: 'Sur de Inglaterra',
  },
  13: { en: 'London', fr: 'Londres', de: 'London', es: 'Londres' },
  14: {
    en: 'South East England',
    fr: 'Sud-Est de l’Angleterre',
    de: 'Südostengland',
    es: 'Sureste de Inglaterra',
  },
  15: { en: 'England', fr: 'Angleterre', de: 'England', es: 'Inglaterra' },
  16: { en: 'Scotland', fr: 'Écosse', de: 'Schottland', es: 'Escocia' },
  17: { en: 'Wales', fr: 'Pays de Galles', de: 'Wales', es: 'Gales' },
};

/** The index levels 1…5, as a state text and a widget tile. */
export const INDEX_TEXT = {
  1: { en: 'Very low', fr: 'Très faible', de: 'Sehr niedrig', es: 'Muy bajo' },
  2: { en: 'Low', fr: 'Faible', de: 'Niedrig', es: 'Bajo' },
  3: { en: 'Moderate', fr: 'Modéré', de: 'Mittel', es: 'Moderado' },
  4: { en: 'High', fr: 'Élevé', de: 'Hoch', es: 'Alto' },
  5: { en: 'Very high', fr: 'Très élevé', de: 'Sehr hoch', es: 'Muy alto' },
};

/** The fuels of the mix, as widget rows. */
export const FUEL_TEXT = {
  wind: { en: 'Wind', fr: 'Éolien', de: 'Wind', es: 'Eólica' },
  solar: { en: 'Solar', fr: 'Solaire', de: 'Solar', es: 'Solar' },
  hydro: { en: 'Hydro', fr: 'Hydraulique', de: 'Wasserkraft', es: 'Hidráulica' },
  biomass: { en: 'Biomass', fr: 'Biomasse', de: 'Biomasse', es: 'Biomasa' },
  nuclear: { en: 'Nuclear', fr: 'Nucléaire', de: 'Kernkraft', es: 'Nuclear' },
  gas: { en: 'Gas', fr: 'Gaz', de: 'Gas', es: 'Gas' },
  coal: { en: 'Coal', fr: 'Charbon', de: 'Kohle', es: 'Carbón' },
  imports: { en: 'Imports', fr: 'Importations', de: 'Importe', es: 'Importaciones' },
  other: { en: 'Other', fr: 'Autres', de: 'Sonstige', es: 'Otras' },
};

/** Fixed texts. */
export const TEXT = {
  intensity: { en: 'Now', fr: 'Maintenant', de: 'Jetzt', es: 'Ahora' },
  index: { en: 'Index', fr: 'Indice', de: 'Index', es: 'Índice' },
  bestWindow: {
    en: 'Best window',
    fr: 'Meilleur créneau',
    de: 'Bestes Fenster',
    es: 'Mejor franja',
  },
  bestMark: { en: 'Best', fr: 'Meilleur', de: 'Bestes', es: 'Mejor' },
  chart: {
    en: 'Forecast, next 24 h',
    fr: 'Prévision, 24 h à venir',
    de: 'Prognose, nächste 24 h',
    es: 'Previsión, próximas 24 h',
  },
  chartSeries: { en: 'gCO₂/kWh', fr: 'gCO₂/kWh', de: 'gCO₂/kWh', es: 'gCO₂/kWh' },
  now: { en: 'now', fr: 'maintenant', de: 'jetzt', es: 'ahora' },
  noZone: {
    en: 'No zone is followed: choose Great Britain, a region or a postcode in the configuration.',
    fr: 'Aucune zone suivie : choisissez la Grande-Bretagne, une région ou un code postal dans la configuration.',
    de: 'Keine Zone ausgewählt: Wähle Großbritannien, eine Region oder eine Postleitzahl in der Konfiguration.',
    es: 'No se sigue ninguna zona: elija Gran Bretaña, una región o un código postal en la configuración.',
  },
  noDevice: {
    en: 'Choose a zone in the widget settings.',
    fr: 'Choisissez une zone dans les réglages du widget.',
    de: 'Wähle eine Zone in den Widget-Einstellungen.',
    es: 'Elija una zona en los ajustes del widget.',
  },
  waiting: {
    en: 'Waiting for the first forecast…',
    fr: 'En attente de la première prévision…',
    de: 'Warte auf die erste Prognose…',
    es: 'Esperando la primera previsión…',
  },
  unreachable: {
    en: 'The Carbon Intensity API cannot be reached right now.',
    fr: "L'API Carbon Intensity est injoignable pour le moment.",
    de: 'Die Carbon Intensity API ist gerade nicht erreichbar.',
    es: 'La API Carbon Intensity no está disponible en este momento.',
  },
  initFailed: {
    en: 'The integration could not start: see its logs.',
    fr: "L'intégration n'a pas pu démarrer : voir ses journaux.",
    de: 'Die Integration konnte nicht starten: siehe ihre Protokolle.',
    es: 'La integración no pudo iniciarse: consulte sus registros.',
  },
  unknownDevice: {
    en: 'This device is not a zone of the current configuration.',
    fr: "Cet appareil n'est pas une zone de la configuration actuelle.",
    de: 'Dieses Gerät ist keine Zone der aktuellen Konfiguration.',
    es: 'Este dispositivo no es una zona de la configuración actual.',
  },
  noForecast: {
    en: 'No forecast covers the next 24 hours for this zone yet.',
    fr: 'Aucune prévision ne couvre encore les 24 prochaines heures pour cette zone.',
    de: 'Für diese Zone deckt noch keine Prognose die nächsten 24 Stunden ab.',
    es: 'Ninguna previsión cubre todavía las próximas 24 horas para esta zona.',
  },
};

const each = (build) => Object.fromEntries(LANGUAGES.map((lang) => [lang, build(lang)]));

/** Texts built from a value. */
export const MESSAGES = {
  /** "London: 180 g/kWh (high)", "Londres : 180 g/kWh (élevé)" */
  zoneOk: (name, intensity, index) =>
    each(
      (lang) =>
        `${pick(name, lang)}${lang === 'fr' ? ' :' : ':'} ${Math.round(intensity)} g/kWh${
          index ? ` (${pick(INDEX_TEXT[index], lang).toLowerCase()})` : ''
        }`,
    ),
  zoneUnknown: (name) =>
    each((lang) => {
      const zone = pick(name, lang);
      return {
        en: `${zone}: unknown to the API`,
        fr: `${zone} : inconnu de l'API`,
        de: `${zone}: der API unbekannt`,
        es: `${zone}: desconocido para la API`,
      }[lang];
    }),
  zoneDown: (name) =>
    each((lang) => {
      const zone = pick(name, lang);
      return {
        en: `${zone}: no answer`,
        fr: `${zone} : pas de réponse`,
        de: `${zone}: keine Antwort`,
        es: `${zone}: sin respuesta`,
      }[lang];
    }),
  /** The status of the Configuration screen when a zone cannot be read. */
  statusFailing: (names) =>
    each(
      (lang) =>
        ({
          en: `Cannot be read: ${names.map((n) => pick(n, lang)).join(', ')}.`,
          fr: `Lecture impossible : ${names.map((n) => pick(n, lang)).join(', ')}.`,
          de: `Nicht lesbar: ${names.map((n) => pick(n, lang)).join(', ')}.`,
          es: `No se puede leer: ${names.map((n) => pick(n, lang)).join(', ')}.`,
        })[lang],
    ),
  rejectedPostcodes: (codes) =>
    each(
      (lang) =>
        ({
          en: `Ignored (not a UK postcode, or more than five): ${codes.join(', ')}.`,
          fr: `Ignoré (pas un code postal britannique, ou plus de cinq) : ${codes.join(', ')}.`,
          de: `Ignoriert (keine britische Postleitzahl oder mehr als fünf): ${codes.join(', ')}.`,
          es: `Ignorado (no es un código postal británico, o más de cinco): ${codes.join(', ')}.`,
        })[lang],
    ),
  updatedAt: (time) =>
    each(
      (lang) =>
        ({
          en: `NESO forecast of ${time}`,
          fr: `Prévision NESO de ${time}`,
          de: `NESO-Prognose von ${time}`,
          es: `Previsión NESO de las ${time}`,
        })[lang],
    ),
};

/** A zone's name: "Great Britain", a region, or the postcode as typed. */
export function zoneName(zone) {
  if (zone.kind === 'national') {
    return each((lang) => NAMES[lang].national);
  }
  if (zone.kind === 'region') {
    return REGION_NAMES[zone.id];
  }
  return each(() => zone.id);
}

/** Join several multi-language texts with a separator, language by language. */
export function joinTexts(separator, ...texts) {
  return each((lang) =>
    texts
      .filter(Boolean)
      .map((text) => pick(text, lang))
      .join(separator),
  );
}

/** "17:30" in the time zone of Gladys (TZ), 24-hour clock in every language. */
export function clockTime(ms, timeZone) {
  return new Date(ms).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    ...(timeZone ? { timeZone } : {}),
  });
}
