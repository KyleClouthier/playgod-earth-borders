// Bakes a historical start (the borders of one year) onto our Earth: our coastlines and cities, their year's borders.
// Borders: historical-basemaps by Andre Ourednik (github.com/aourednik/historical-basemaps), GPLv3. Kept as separate data
// files (eras/<year>/) apart from the game code and published here under the GPLv3, as historical-basemaps is.
// Get the input from github.com/aourednik/historical-basemaps (geojson/world_<year>.geojson) into input/.
// Colonies are folded into their empire (SUBJECTO), so 1914's British Empire is one nation across the world.
// Input: input/world_<year>.geojson. Output: eras/<year>/{grid.bin,nations.json,cities.json}. Needs: npm i d3-geo
// Usage: node tools/bake_era.mjs 1914 [1938 1960 ...]
import fs from 'node:fs';
import path from 'node:path';
import { geoContains, geoBounds, geoArea } from 'd3-geo';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const W = 1024, H = 512;
const base = new Uint8Array(fs.readFileSync(path.join(ROOT, 'base/grid.bin')));
const baseNations = JSON.parse(fs.readFileSync(path.join(ROOT, 'base/nations.json'), 'utf8'));
const baseCities = JSON.parse(fs.readFileSync(path.join(ROOT, 'base/cities.json'), 'utf8'));
const lng = (x) => -180 + (x + 0.5) * 360 / W, lat = (y) => 90 - (y + 0.5) * 180 / H;

// the same country under two spellings in one file
const ALIAS = { 'United Kingdom': 'United Kingdom of Great Britain and Ireland', Italy: 'Kingdom of Italy', Russia: 'Russian Empire', 'Japan': 'Empire of Japan' };
// shorter names for the map, by year
const SHOW = {
  1914: { 'United Kingdom of Great Britain and Ireland': 'British Empire', 'Rattanakosin Kingdom': 'Siam', 'Kingdom of Italy': 'Italy', 'Empire of Japan': 'Japan' },
  1938: { 'United Kingdom of Great Britain and Ireland': 'British Empire', 'United Kingdom': 'British Empire', 'Empire of Japan': 'Empire of Japan', 'USSR': 'Soviet Union' },
  1960: { USSR: 'Soviet Union' },
};
// the capitals of the time, where the biggest city would be wrong
const CAPITAL = {
  'British Empire': 'London', 'Austro-Hungarian Empire': 'Vienna', 'Ottoman Empire': 'Istanbul', 'Russian Empire': 'Saint Petersburg', 'German Empire': 'Berlin',
  France: 'Paris', 'Soviet Union': 'Moscow', 'United States': 'Washington, D.C.', 'Empire of Japan': 'Tokyo', Japan: 'Tokyo', Italy: 'Rome', Spain: 'Madrid',
  Portugal: 'Lisbon', Netherlands: 'Amsterdam', Belgium: 'Brussels', China: 'Beijing', 'Qing Empire': 'Beijing', Brazil: 'Rio de Janeiro', Germany: 'Berlin', Turkey: 'Ankara',
};
// city names of their time
const CITY = {
  1914: { Istanbul: 'Constantinople', Beijing: 'Peking', Mumbai: 'Bombay', Chennai: 'Madras', Kolkata: 'Calcutta', 'Ho Chi Minh City': 'Saigon', Yangon: 'Rangoon', Jakarta: 'Batavia',
    Volgograd: 'Tsaritsyn', Kinshasa: 'Leopoldville', Harare: 'Salisbury', Maputo: 'Lourenco Marques', Oslo: 'Kristiania', 'Saint Petersburg': 'Petrograd' },
  1938: { Beijing: 'Peiping', Mumbai: 'Bombay', Chennai: 'Madras', Kolkata: 'Calcutta', 'Ho Chi Minh City': 'Saigon', Yangon: 'Rangoon', Jakarta: 'Batavia', Volgograd: 'Stalingrad',
    Kinshasa: 'Leopoldville', Harare: 'Salisbury', 'Saint Petersburg': 'Leningrad' },
  1960: { Mumbai: 'Bombay', Chennai: 'Madras', Kolkata: 'Calcutta', 'Ho Chi Minh City': 'Saigon', Yangon: 'Rangoon', Volgograd: 'Stalingrad', Kinshasa: 'Leopoldville', Harare: 'Salisbury',
    'Saint Petersburg': 'Leningrad' },
};

for (const year of process.argv.slice(2).map(Number)) {
  const geo = JSON.parse(fs.readFileSync(path.join(ROOT, `input/world_${year}.geojson`), 'utf8'));
  // shapes drawn the "wrong way round" read as everything except themselves on a sphere: flip any that claims over half the
  // planet (Chile's Antarctic claim in 1938 swallowed the world before this)
  for (const f of geo.features) {
    if (!f.geometry) continue;
    if (geoArea(f) > 2 * Math.PI) {
      const flip = (poly) => poly.map((ring) => ring.slice().reverse());
      if (f.geometry.type === 'Polygon') f.geometry.coordinates = flip(f.geometry.coordinates);
      else if (f.geometry.type === 'MultiPolygon') f.geometry.coordinates = f.geometry.coordinates.map(flip);
    }
    // a multipolygon can hold one part the wrong way round: check each part on its own
    if (f.geometry.type === 'MultiPolygon') f.geometry.coordinates = f.geometry.coordinates.map((poly) => (geoArea({ type: 'Polygon', coordinates: poly }) > 2 * Math.PI ? poly.map((r) => r.slice().reverse()) : poly));
  }
  const names = new Set(geo.features.map((f) => f.properties.NAME).filter(Boolean));
  const sovereign = (p) => {
    let s = p.SUBJECTO && p.SUBJECTO !== p.NAME ? p.SUBJECTO : p.NAME;
    if (s && !names.has(s) && ALIAS[s] && names.has(ALIAS[s])) s = ALIAS[s];
    return s || null;
  };
  const show = (s) => (SHOW[year] && SHOW[year][s]) || s;
  const idx = new Map(), list = [];
  const grid = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) if (base[i] === 255) grid[i] = 255;
  for (const f of geo.features) {
    const s = sovereign(f.properties); if (!s) continue;
    const name = show(s);
    if (!idx.has(name)) { if (list.length >= 253) continue; idx.set(name, list.length + 1); list.push(name); }
    const id = idx.get(name);
    const [[x0, y0], [x1, y1]] = geoBounds(f);
    const gx = (l) => Math.floor((l + 180) * W / 360), xs = [];
    if (x0 <= x1) for (let x = Math.max(0, gx(x0)); x <= Math.min(W - 1, gx(x1)); x++) xs.push(x);
    else { for (let x = gx(x0); x < W; x++) xs.push(x); for (let x = 0; x <= gx(x1); x++) xs.push(x); }
    const ya = Math.max(0, Math.floor((90 - y1) * H / 180)), yb = Math.min(H - 1, Math.ceil((90 - y0) * H / 180));
    for (let y = ya; y <= yb; y++) for (const x of xs) {
      const i = y * W + x;
      if (!base[i] || base[i] === 255 || grid[i]) continue;          // only our land, first claim wins
      if (geoContains(f, [lng(x), lat(y)])) grid[i] = id;
    }
  }
  // our coastline is not theirs: land they left unclaimed goes to the nearest claimed neighbour
  let q = []; for (let i = 0; i < W * H; i++) if (grid[i] && grid[i] !== 255) q.push(i);
  let filled = 0;
  for (let qi = 0; qi < q.length; qi++) {
    const c = q[qi], x = c % W, y = (c / W) | 0;
    for (const m of [y * W + (x + 1) % W, y * W + (x + W - 1) % W, y < H - 1 ? c + W : -1, y > 0 ? c - W : -1]) {
      if (m < 0 || !base[m] || base[m] === 255 || grid[m]) continue;
      grid[m] = grid[c]; q.push(m); filled++;
    }
  }
  // drop nations that ended up with no land on our grid, and renumber
  const cells = new Uint32Array(list.length + 2);
  for (let i = 0; i < W * H; i++) if (grid[i] && grid[i] !== 255) cells[grid[i]]++;
  const remap = new Uint8Array(256), nations = [];
  list.forEach((name, k) => {
    const old = k + 1; if (!cells[old]) return;
    remap[old] = nations.length + 1;
    const modern = baseNations.find((n) => n.name === name);
    nations.push({ code: `H${year}_${nations.length + 1}`, a2: modern ? modern.a2 : '', name, names: modern ? modern.names : {}, pop: 0, cont: modern ? modern.cont : '' });
  });
  remap[255] = 255;
  for (let i = 0; i < W * H; i++) if (grid[i]) grid[i] = remap[grid[i]];
  // cities: ours, renamed for the time; each nation's capital from the list above, else its biggest city
  const cities = baseCities.map((c) => ({ ...c, n: (CITY[year] && CITY[year][c.n]) || c.n, cap: 0 }));
  const owner = (c) => grid[c.cell];
  for (const [k, n] of nations.entries()) {
    const id = k + 1, mine = cities.filter((c) => owner(c) === id);
    for (const c of mine) n.pop += c.pop;
    const want = CAPITAL[n.name] && mine.find((c) => c.n === CAPITAL[n.name] || baseCities.find((b) => b.cell === c.cell && b.n === CAPITAL[n.name]));
    const cap = want || mine.sort((a, b) => b.pop - a.pop)[0];
    if (cap) cap.cap = 1;
  }
  const OUT = path.join(ROOT, 'eras', String(year)); fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'grid.bin'), grid);
  fs.writeFileSync(path.join(OUT, 'nations.json'), JSON.stringify(nations));
  fs.writeFileSync(path.join(OUT, 'cities.json'), JSON.stringify(cities));
  const top = nations.map((n, k) => [n.name, cells[list.indexOf(n.name) + 1]]).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([n, c]) => n + ' ' + c).join(', ');
  console.log(year, nations.length, 'nations,', filled, 'coast cells filled. Biggest:', top);
}
