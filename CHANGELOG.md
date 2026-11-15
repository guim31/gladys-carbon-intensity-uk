# Changelog

All notable changes to this integration are documented in this file. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project
uses [semantic versioning](https://semver.org/).

Describe each change under `## [Unreleased]` as you make it. The Release
workflow moves that section under the version it ships, and the section becomes
the notes of the version's GitHub Release.

## [Unreleased]

## [1.0.0] - 2026-11-15

### Added

- The carbon intensity of British electricity from the NESO Carbon Intensity
  API, without account or key: one device per zone followed (Great Britain,
  any of the 17 regions, up to five postcodes) with the intensity of the
  half-hour in progress, the NESO index, the low-carbon and renewable shares
  and the share of each source.
- The best window of the next 24 hours for a length from 30 minutes to 6
  hours: start time, minutes until it starts and average intensity.
- A "Carbon intensity forecast" dashboard widget: intensity, index, best
  window, 24-hour forecast curve and electricity mix.
- Scene triggers "Carbon index turns low" and "Best window starts", and a
  scene action "Find the best window".
- A "Test the connection" button, and the zones that cannot be read shown on
  the Configuration screen.
- Every text in English, French, German and Spanish.

[Unreleased]: https://github.com/guim31/gladys-carbon-intensity-uk/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/guim31/gladys-carbon-intensity-uk/releases/tag/v1.0.0
