# Carbon Intensity UK for Gladys Assistant

External integration for [Gladys Assistant](https://gladysassistant.com) that
follows the **carbon intensity of British electricity** from the official
[Carbon Intensity API](https://carbonintensity.org.uk) of NESO (National Energy
System Operator, formerly National Grid ESO): now, the 48-hour forecast, and the
cleanest window of the next 24 hours. For Great Britain, any of its 17 regions,
or a postcode. No account, no key.

Built from the
[official JavaScript integration template](https://github.com/GladysAssistant/integration-template-js)
and the SDK
[`@gladysassistant/integration-sdk`](https://github.com/GladysAssistant/integration-sdk-js).

## Features

- **One device per zone** (Great Britain, a region, a postcode): carbon
  intensity of the half-hour in progress (gCO₂/kWh), the NESO index (1 very low
  … 5 very high, and as a word), the low-carbon and renewable shares, the share
  of each of the nine sources of the mix, and the **best window** of the next
  24 hours for a length you choose (start time, minutes until it starts, its
  average intensity).
- **Widget** "Carbon intensity forecast": intensity and index, the best window,
  the 24-hour forecast curve with the best window and "now" marked, the mix as
  bars (each optional block can be hidden).
- **Scene triggers**: "Carbon index turns low" (moderate or worse → low or
  very low) and "Best window starts" (once per window).
- **Scene action** "Find the best window": start, end, minutes until and
  average intensity of the cleanest window of any length, for the following
  actions.

Next to [Electricity Maps](https://github.com/prohand/gladys-electricity-maps)
(worldwide, with a key): this one is the official British source, without a
key, by region and postcode, with the forecast and the best window.

## Requirements

- Gladys Assistant **5.3.0** or later.
- Internet access to `api.carbonintensity.org.uk` (Great Britain only:
  Northern Ireland is not covered).

## Installation

In Gladys: **Integrations → Install from GitHub**, then
`https://github.com/guim31/gladys-carbon-intensity-uk`. In the Configuration
tab, choose the zones (Great Britain is on by default), save, and add the
devices from the Discovery tab. The user documentation is in
[`docs/en.md`](docs/en.md) (also [fr](docs/fr.md), [de](docs/de.md),
[es](docs/es.md)).

## How it works

- `GET /intensity/{now}/fw48h` (+ `/generation` for the national mix),
  `GET /regional/intensity/{now}/fw48h/regionid/{1-17}` and
  `.../postcode/{outward}`: the forecast of the next 48 hours in half-hour
  slots, starting with the slot in progress.
- The devices declare no poll frequency: the container ticks every minute on
  its own timer, reads a zone once per half-hour slot (only zones whose device
  is added or whose widget is shown), retries a failure after 5 minutes, and
  publishes only the states that change (each re-sent every 6 hours). While
  the API is down, the stored 48-hour forecast still gives the half-hour in
  progress.
- Only the outward part of a postcode is ever sent (`RG10` for `RG10 9AB`).
- The triggers are remembered under `/data` so a restart does not fire them
  again.

## Checked, and what was not

Checked: the test suite (the SDK's fake Gladys, a fake API serving **real
answers** recorded on 15/11/2026: national, region 13, postcodes RG10 and EH1,
unknown postcode, unknown region), the conformity test against the core's
table of category/type couples, the store validator, and the Docker image
started with the Gladys sandbox constraints, reading the real API from inside
the locked container.

Not checked: a real Gladys instance (the dashboard rendering of the widget,
the scene editor).

## Limitations

- The intensity is NESO's forecast for the current half-hour: the API has no
  measured figure for regions nor for the slot in progress.
- The shares of each source are whole percentages on the devices (Gladys has
  no generic decimal percentage sensor).
- Up to five postcodes; the best window is looked for in the next 24 hours.
- The API publishes no quota; the integration makes at most two calls per
  zone and half-hour.

## Development

```bash
npm ci
npm run format:check
npm run lint
npm test
npx -y github:GladysAssistant/integration-store --skip-image-check .
```

See [`CLAUDE.md`](CLAUDE.md) for the project rules. Versions, images and
releases belong to the Release workflow (Actions → Release).

## Credits

- [NESO](https://www.neso.energy) and the
  [Carbon Intensity API](https://carbonintensity.org.uk) (data under
  [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), developed with the
  Environmental Defense Fund Europe, University of Oxford and WWF).
- Cover: the NESO logo, from [neso.energy](https://www.neso.energy), a trademark
  of NESO, shown to name the data source.
- The architecture, the conformity and language tests follow
  [gladys-wled](https://github.com/guim31/gladys-wled) and
  [gladys-rte](https://github.com/guim31/gladys-rte).

## Disclaimer

This project is not affiliated with, endorsed or sponsored by NESO. Carbon
Intensity is a NESO service; its data stay subject to its terms of use.

## License

[Apache-2.0](LICENSE).
