# Carbon Intensity UK

How clean British electricity is, right now and for the next 24 hours, from
the official [Carbon Intensity API](https://carbonintensity.org.uk) of NESO
(the National Energy System Operator, formerly National Grid ESO). For Great
Britain as a whole, for a region, or for your postcode. This integration is
not affiliated with NESO.

## Overview

For every zone you follow (Great Britain, a region, a postcode), the
integration adds a device with:

- the **carbon intensity** of the electricity of the current half-hour, in
  gCO₂/kWh, and the NESO **index** (very low → very high);
- the **electricity mix**: share of wind, solar, nuclear, gas, imports,
  biomass, hydro, coal and other sources, plus the low-carbon and renewable
  shares;
- the **best window** of the next 24 hours: when the cleanest run of the
  length you chose (3 hours by default) starts, in how many minutes, and its
  average intensity.

On top of that: a dashboard widget with the 24-hour forecast curve, two scene
triggers ("Carbon index turns low", "Best window starts") and a scene action
that finds the best window of any length, to run the dishwasher or charge the
car when the grid is cleanest.

## Requirements

- Gladys Assistant 5.3.0 or later.
- Gladys must reach `api.carbonintensity.org.uk` on the internet. No account,
  no key: the data is open, under the CC BY 4.0 licence.
- The zones are in Great Britain (England, Scotland, Wales): Northern Ireland
  is not covered by the API.

## Configuration

1. Install the integration (**Integrations → Install from GitHub**, then the
   address of the repository).
2. In its **Configuration** tab:
   - **Language of the names**: language of the device and feature names
     (fixed when a device is added) and of the texts sent to scenes;
   - **Great Britain as a whole**: one device for the national figures (on by
     default);
   - **Regions**: any of the 14 regions of the distribution networks, plus
     England, Scotland and Wales;
   - **Postcodes**: up to five UK postcodes, comma-separated. Only the first
     part counts (`RG10` for `RG10 9AB`): the API maps it to its region. Your
     full postcode is never sent;
   - **Length of the best window**: from 30 minutes to 6 hours.
3. Save, then add the devices from the **Discovery** tab.

### Test the connection button

Reads every zone at once and shows its current intensity, or what went wrong
(no answer, postcode unknown to the API, text that is not a postcode).

## Devices

### Carbon intensity (one per zone)

| Feature                           | Value                                              |
| --------------------------------- | -------------------------------------------------- |
| Carbon intensity                  | gCO₂/kWh of the half-hour in progress              |
| Carbon index (1 to 5)             | 1 very low, 2 low, 3 moderate, 4 high, 5 very high |
| Carbon index                      | the same index, as a word                          |
| Low-carbon share, renewable share | %                                                  |
| Wind, solar, nuclear, gas… share  | % of each source, rounded                          |
| Best window start                 | time, for example `03:00`                          |
| Best window starts in             | minutes, 0 once it has begun                       |
| Best window intensity             | its average gCO₂/kWh                               |

The intensity is NESO's **forecast** for the half-hour in progress: the API has
no measured figure for regions, nor for the current half-hour. "Low-carbon"
counts wind, solar, hydro, biomass and nuclear; imports and "other" count as
neither.

## Widget

**Carbon intensity forecast** shows, for the zone chosen in its settings (the
first zone by default): the intensity now and the index, the start of the best
window, the forecast curve of the next 24 hours with the best window and the
current time marked, and the electricity mix of the half-hour as bars. Two
settings hide the best window and the mix.

## Scenes

### Carbon index turns low (trigger)

Fires when the index of a zone goes from moderate (or worse) to low or very
low. Filters: the zone, the index reached. Variables: `level`
(`very_low`, `low`), `index` (1, 2), `index_label`, `intensity`, `zone`.

### Best window starts (trigger)

Fires when the half-hour in progress opens the cleanest window of the next 24
hours, for the length set in the configuration, once per window. Filter: the
zone. Variables: `duration_minutes`, `average_intensity`, `end_time`, `zone`.
In a zone that stays at 0 g/kWh (often South Scotland), every window is
equally clean: it fires again at the end of each one.

### Find the best window (action)

Choose a zone and a length: the action returns `start_time`, `end_time`,
`minutes_until` and `average_intensity` for the following actions of the
scene, for example to send yourself a message "Start the washing machine at
02:30".

## Scene examples

- Every evening at 8 pm, **Find the best window** of 2 hours, then send
  "Best time for the dishwasher: {{start_time}}".
- **Best window starts** → switch on the plug of the electric car charger;
  a scheduled scene switches it off in the morning.
- **Carbon index turns low** → turn on the water heater, with a condition on
  the time of day.

## Limits

- Data every half-hour: the integration reads each zone once per half-hour
  slot (two calls for Great Britain, one for a region or postcode), only when
  its device is added or its widget is displayed. The API asks for no key
  and states no quota; it is used with this restraint.
- If the API is unreachable, the devices keep following the last 48-hour
  forecast, and the Configuration screen shows the zones that cannot be read.
- Times are in the time zone of Gladys.

## Troubleshooting

- **"Cannot be read: RG10"**: the API does not know the postcode, or does not
  answer. Use the **Test the connection** button to tell which.
- **No device in Discovery**: no zone is followed; tick Great Britain or
  choose a region or a postcode.
- Logs: the integration logs its start, the zones followed and failures. For
  more detail, set the `LOG_LEVEL=debug` environment variable.

## Credits

Data: NESO Carbon Intensity API, CC BY 4.0 — "Carbon Intensity data from NESO".
API documentation: <https://carbon-intensity.github.io/api-definitions/>. This
integration is not affiliated with NESO.
