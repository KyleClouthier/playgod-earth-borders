# Play God on Earth: historical borders

The historical starts in [Play God on Earth](https://playgod.earth) (the borders of 1914, 1938 and 1960) are made from
**historical-basemaps** by Andre Ourednik ([github.com/aourednik/historical-basemaps](https://github.com/aourednik/historical-basemaps)),
which is licensed under the GNU GPL v3. As that licence asks, the files derived from it, and the tool that makes them, are
published here under the same licence.

- `eras/<year>/`: the baked borders the game loads for that year (`grid.bin` = owner of each map cell, 1024 x 512;
  `nations.json`; `cities.json`). **GPLv3** (see `LICENSE`).
- `tools/bake_era.mjs`: the tool that bakes a year's borders onto the game's map. **GPLv3**.
  Put `world_<year>.geojson` from historical-basemaps in `input/`, run `npm i d3-geo`, then `node tools/bake_era.mjs 1914`.
- `base/`: the game's own present-day map the tool bakes onto (coastlines, countries and cities derived from
  [Natural Earth](https://www.naturalearthdata.com/), which is public domain). These three files are offered under
  **CC0 1.0** (public domain dedication), so they can be used with the GPL files freely.

The game's own code is a separate work and is not part of this repository.

Made by Clouthier Simulation Labs, Petawawa, Ontario, Canada. Contact: kyle@simgen.dev.
