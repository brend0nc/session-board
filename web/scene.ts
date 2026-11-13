/* The view at the top of the board, drawn cell by cell: sky, a mountain of the region, trees in the wind, water.
   One cell is 4 by 4 pixels. The layout is fixed by a seed, so it stays the same for one day. */
import { creature, legs } from "./creatures.js";
import { profile, Trees, View } from "./mountains.js";
import { hash, seeded } from "./util.js";

export type Phase = "night" | "dawn" | "day" | "dusk";

interface Palette {
  sky: string[]; star?: string; star2?: string; orb: string; orb2: string; cloud?: string;
  far: string; rock: string; rock2: string; snow: string; red: string; red2: string;
  land: string; land2: string; sand: string; sand2: string; tree: string; tree2: string; trunk: string;
  light?: string; spark: string; sea: string; sea2: string; glint: string; foam: string; wake: string;
}

const PALETTES: Record<Phase, Palette> = {
  night: {
    sky: ["#0a0f24", "#10183a", "#18234f", "#22305f"], star: "#dfe6ff", star2: "#7f8fc4", orb: "#f0ecd8", orb2: "#cfc9ae",
    far: "#111936", rock: "#080b1a", rock2: "#0d1228", snow: "#3c4a78", red: "#0b0a18", red2: "#100e20",
    land: "#0a0e20", land2: "#0d1226", sand: "#0c0f20", sand2: "#101326", tree: "#04070f", tree2: "#0a1020", trunk: "#04070f",
    light: "#ffcf7a", spark: "#fff3c4", sea: "#0c1432", sea2: "#101a40", glint: "#2a3a78", foam: "#46589a", wake: "#8a96c8",
  },
  dawn: {
    sky: ["#2f3f7a", "#7a6a9c", "#d98f8f", "#f6c48a"], star: "#e8e8ff", orb: "#ffe3a0", orb2: "#ffc56a", cloud: "#f3d3c4",
    far: "#6a6690", rock: "#34365c", rock2: "#2b2c4e", snow: "#f6cdc4", red: "#5a2f3e", red2: "#4a2634",
    land: "#2a2b48", land2: "#33345a", sand: "#4a3d58", sand2: "#42354e", tree: "#1c1d38", tree2: "#28294a", trunk: "#1c1d38",
    light: "#ffd98a", spark: "#fff1c2", sea: "#4a5a94", sea2: "#3e4d86", glint: "#f0b48a", foam: "#ffe2c4", wake: "#ffd9a0",
  },
  day: {
    sky: ["#5d9bd6", "#7fb3e3", "#a8cdee", "#d3e7f6"], orb: "#fff2a8", orb2: "#ffe27a", cloud: "#ffffff",
    far: "#8eabc0", rock: "#7b8a7a", rock2: "#66766a", snow: "#f6faff", red: "#b5532f", red2: "#96421f",
    land: "#7a9a72", land2: "#6c8c66", sand: "#cfa56c", sand2: "#bd9560", tree: "#2f6b45", tree2: "#3f8a57", trunk: "#5a4632",
    spark: "#fff7cf", sea: "#3f82b8", sea2: "#3776ab", glint: "#8fc0e6", foam: "#eef8ff", wake: "#e8f4ff",
  },
  dusk: {
    sky: ["#272b66", "#6c4a86", "#d9736a", "#f6b668"], star: "#f3e9ff", orb: "#ffb24d", orb2: "#ff9a3d", cloud: "#e9a0a0",
    far: "#4b3f66", rock: "#241f3c", rock2: "#1c1830", snow: "#e8a69c", red: "#5e2a2a", red2: "#4a2020",
    land: "#1a162b", land2: "#221c36", sand: "#3a2a3a", sand2: "#322432", tree: "#100d1e", tree2: "#1a152c", trunk: "#100d1e",
    light: "#ffcf7a", spark: "#fff3c4", sea: "#34346e", sea2: "#2b2b60", glint: "#f08a5c", foam: "#ffc9a0", wake: "#ffc27a",
  },
};

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const CLOUDS = [["  ####  ", " ###### ", "########"], [" ###  ", "######"], ["   ###    ", " #######  ", "##########"]];

/* Tree shapes. Each canopy row is [offset from the trunk, width], from the top down. */
const CANOPY: Record<Trees, [number, number][][]> = {
  pine: [[[0, 1], [-1, 3], [-1, 3], [-2, 5]], [[0, 1], [-1, 3], [-1, 3], [-2, 5], [-2, 5], [-3, 7]]],
  round: [[[-1, 3], [-2, 5], [-2, 5], [-1, 3]], [[-1, 3], [-2, 5], [-3, 7], [-3, 7], [-2, 5]]],
  umbrella: [[[-2, 5], [-3, 7], [-2, 5]], [[-2, 5], [-3, 7], [-4, 9], [-3, 7]]],
  acacia: [[[-3, 7], [-4, 9], [-2, 5]], [[-4, 9], [-5, 11], [-3, 7]]],
  palm: [[], []],
  shrub: [[[-1, 3], [-2, 5]], [[-1, 3], [-2, 5], [-2, 5]]],
};
const TRUNK: Record<Trees, number[]> = { pine: [2, 2], round: [2, 3], umbrella: [3, 4], acacia: [3, 4], palm: [5, 7], shrub: [0, 0] };
const FRONDS: [number, number][] = [[-3, 1], [-2, 0], [-1, -1], [0, -1], [1, -1], [2, 0], [3, 1], [-1, 0], [0, 0], [1, 0]];
const EVERY: Record<Trees, number> = { pine: 6, round: 9, umbrella: 11, acacia: 17, palm: 13, shrub: 12 };

interface Tree { x: number; base: number; size: number; phase: number }

interface Layout {
  heights: number[];
  far: number[];
  trees: Tree[];
  stars: [number, number][];
  clouds: [number, number, number, number][];
  lights: [number, number][];
}

export interface PaintOpts {
  /** Height in cells, and the row of the horizon. */
  rows: number;
  horizon: number;
  /** Height of the mountain in cells. */
  rise: number;
  /** Minutes since midnight at the place. */
  minutes: number;
  frame: number;
  view: View;
  seed: number;
  /** Ids of the sessions that work now: each gets a light on the shore. */
  sparks: string[];
  /** One creature that stands on the shore. */
  cast: { id: string; walking: boolean } | null;
}

export function phaseOf(minutes: number): Phase {
  if (minutes >= 330 && minutes < 420) return "dawn";
  if (minutes >= 420 && minutes < 1080) return "day";
  if (minutes >= 1080 && minutes < 1185) return "dusk";
  return "night";
}

function rgba(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  return (0xff000000 | ((n & 0xff) << 16) | (n & 0xff00) | (n >> 16)) >>> 0;
}

const layouts = new Map<string, Layout>();

function layoutFor(W: number, o: PaintOpts): Layout {
  const key = [W, o.rows, o.view.id, o.seed, o.cast ? 1 : 0].join("|");
  const found = layouts.get(key);
  if (found) return found;
  if (layouts.size > 12) layouts.clear();
  const rnd = seeded(o.seed ^ hash(o.view.id));
  const H = o.rows, HZ = o.horizon;
  const heights = profile(o.view, W, rnd);

  const a = 0.03 + rnd() * 0.04, b = 0.009 + rnd() * 0.012, p1 = rnd() * 6, p2 = rnd() * 6;
  const far: number[] = [];
  for (let x = 0; x < W; x++) far.push(Math.max(1, Math.round(4 + 2.4 * Math.sin(x * a + p1) + 1.8 * Math.sin(x * b + p2))));

  const trees: Tree[] = [];
  const landOnly = o.view.front === "land";
  const count = Math.round(W / EVERY[o.view.trees]);
  for (let i = 0; i < count; i++) {
    const x = 3 + Math.floor(rnd() * (W - 6));
    if (o.cast && x > W - 24) continue;
    // on land the trees stand at many depths; next to water they stand on the shore
    const depth = landOnly ? Math.floor(rnd() * Math.max(1, H - HZ - 2)) : Math.floor(rnd() * 2);
    trees.push({ x, base: HZ + 1 + depth, size: landOnly && depth > (H - HZ) / 3 ? 1 : rnd() < 0.3 ? 1 : 0, phase: rnd() * 6 });
  }
  trees.sort((s, t) => s.base - t.base);

  const stars: [number, number][] = [];
  for (let i = 0; i < Math.round((W * HZ) / 200); i++) stars.push([Math.floor(rnd() * W), Math.floor(rnd() * Math.max(2, HZ - 9))]);
  const clouds: [number, number, number, number][] = [];
  for (let i = 0; i < 2 + Math.floor(rnd() * 3); i++) {
    clouds.push([rnd() * W, 2 + Math.floor(rnd() * Math.max(2, HZ * 0.45)), 0.03 + rnd() * 0.05, Math.floor(rnd() * CLOUDS.length)]);
  }
  const lights: [number, number][] = [];
  for (let i = 0; i < Math.round(W / (landOnly ? 12 : 6)); i++) lights.push([Math.floor(rnd() * W), HZ - 1 + Math.floor(rnd() * 4)]);

  const made = { heights, far, trees, stars, clouds, lights };
  layouts.set(key, made);
  return made;
}

export function paint(canvas: HTMLCanvasElement, o: PaintOpts): void {
  if (!canvas.clientWidth) return;
  const W = Math.max(40, Math.ceil(canvas.clientWidth / 4)), H = o.rows, HZ = o.horizon;
  if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }
  const L = layoutFor(W, o);
  const P = PALETTES[phaseOf(o.minutes)];
  const night = !P.cloud;
  const ctx = canvas.getContext("2d")!;
  const img = ctx.createImageData(W, H);
  const buf = new Uint32Array(img.data.buffer);
  const set = (x: number, y: number, c: number) => { if (x >= 0 && x < W && y >= 0 && y < H) buf[y * W + x] = c; };
  const dither = (x: number, y: number, f: number) => f > (BAYER[(x & 3) + ((y & 3) << 2)] + 0.5) / 16;
  const t = o.frame;

  // sky
  const sky = P.sky.map(rgba);
  for (let y = 0; y < HZ; y++) {
    const at = (y / (HZ - 1)) * (sky.length - 1), i = Math.min(Math.floor(at), sky.length - 2);
    for (let x = 0; x < W; x++) set(x, y, dither(x, y, at - i) ? sky[i + 1] : sky[i]);
  }
  if (P.star) {
    const bright = rgba(P.star), dim = rgba(P.star2 || P.star);
    const shown = night ? L.stars.length : Math.round(L.stars.length / 4);
    for (let i = 0; i < shown; i++) if ((i + (t >> 2)) % 9) set(L.stars[i][0], L.stars[i][1], i % 3 ? dim : bright);
  }

  // sun or moon
  const sun = o.minutes >= 360 && o.minutes < 1155;
  const p = sun ? (o.minutes - 360) / 795 : ((o.minutes - 1155 + 1440) % 1440) / 645;
  const cx = Math.round(W * (0.24 + 0.7 * p)), cy = Math.round(HZ - 5 - Math.sin(Math.PI * p) * (HZ - 12));
  const orb = rgba(P.orb), orb2 = rgba(P.orb2);
  for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) if (dx * dx + dy * dy <= 10) set(cx + dx, cy + dy, orb);
  if (sun) { set(cx - 1, cy - 2, orb2); set(cx + 2, cy + 1, orb2); }
  else { set(cx - 1, cy - 1, orb2); set(cx + 1, cy + 1, orb2); set(cx + 1, cy - 2, orb2); set(cx - 2, cy + 1, orb2); }

  if (P.cloud) {
    const c = rgba(P.cloud);
    for (const [start, y, speed, shape] of L.clouds) {
      const x0 = Math.floor((start + t * speed) % (W + 16)) - 10;
      CLOUDS[shape].forEach((row, ry) => [...row].forEach((ch, rx) => { if (ch === "#") set(x0 + rx, y + ry, c); }));
    }
  }

  // far range, then the mountain with its snow
  const far = rgba(P.far);
  const red = o.view.rock === "red";
  const rock = rgba(red ? P.red : P.rock), rock2 = rgba(red ? P.red2 : P.rock2), snow = rgba(P.snow);
  const snowLine = HZ - o.rise * Math.max(...L.heights) * (1 - o.view.snow);
  const top: number[] = [];
  let peak = 0;
  for (let x = 0; x < W; x++) {
    for (let y = HZ - L.far[x]; y < HZ; y++) set(x, y, far);
    top[x] = HZ - Math.round(L.heights[x] * o.rise);
    if (top[x] < top[peak]) peak = x;
    for (let y = top[x]; y < HZ; y++) {
      const white = o.view.snow > 0 && y < snowLine + (BAYER[(x & 3) + ((y & 3) << 2)] / 16) * 3 - 1;
      set(x, y, white ? snow : y - top[x] > (HZ - top[x]) * 0.5 && ((x + y) & 1) === 0 ? rock2 : rock);
    }
  }
  if (o.view.smoke) {
    const puff = rgba(P.cloud || P.far);
    for (let i = 0; i < 7; i++) {
      const drift = Math.round(i * 1.4 + Math.sin(t * 0.2 + i) * 1.2);
      set(peak + drift, top[peak] - 2 - i, puff);
      if (i > 2) set(peak + drift + 1, top[peak] - 2 - i, puff);
    }
  }

  // ground
  const dry = red || o.view.trees === "shrub" || o.view.trees === "acacia";
  const ground = rgba(dry ? P.sand : P.land), ground2 = rgba(dry ? P.sand2 : P.land2);
  const water = o.view.front !== "land";
  const groundEnd = water ? HZ + 4 : H;
  for (let y = HZ; y < groundEnd; y++) {
    const f = (y - HZ) / Math.max(1, H - HZ);
    for (let x = 0; x < W; x++) set(x, y, dither(x, y, f * 0.9) ? ground2 : ground);
  }
  if (!water) {
    // grass that leans with the wind
    const blade = rgba(P.tree2);
    for (let y = HZ + 2; y < H; y += 2) for (let x = (y * 7) % 9; x < W; x += 9 + (y % 5)) {
      const lean = Math.sin(t * 0.4 + x * 0.15) > 0.5 ? 1 : 0;
      set(x + lean, y, blade);
    }
  }
  if (P.light) {
    const c = rgba(P.light);
    L.lights.forEach(([x, y], i) => { if ((i * 7 + (t >> 2)) % 13) set(x, y, c); });
  }
  if (o.sparks.length) {
    const lit = rgba(P.spark), dim = rgba(P.light || P.glint);
    for (const id of o.sparks) {
      const x = Math.round(W * (0.06 + (hash(id) % 880) / 1000));
      const c = (t >> 1) & 1 ? lit : dim;
      set(x, HZ + 1, c);
      set(x + 1, HZ + 1, c);
    }
  }

  // water: the sea has waves that move to the shore; a lake is calm and shows the mountain
  if (water) {
    const seaTop = HZ + 4;
    const sea = rgba(P.sea), sea2 = rgba(P.sea2), glint = rgba(P.glint), foam = rgba(P.foam), wake = rgba(P.wake);
    const lake = o.view.front === "lake";
    for (let y = seaTop; y < H; y++) {
      const d = (y - seaTop) / Math.max(1, H - seaTop - 1);
      const period = 8 + Math.round(d * 9), len = 2 + Math.round(d * 3), move = Math.floor(t * (0.25 + d * 0.75)), off = (y * 37) % period;
      for (let x = 0; x < W; x++) {
        let c = dither(x, y, d * 0.8) ? sea2 : sea;
        if (lake) {
          if (HZ - 1 - (y - seaTop) * 2 >= top[x] && ((x + y) & 1) === 0) c = sea2;
          if ((x * 31 + y * 17 + (t >> 2) * 7) % 41 === 0) c = glint;
        } else if ((y - seaTop) % 2 === 0 && (x + move + off) % period < len) {
          c = glint;
        }
        set(x, y, c);
      }
      if ((y + (t >> 1)) & 1) set(cx + ((y * 3 + (t >> 1)) % 3) - 1, y, wake);
    }
    if (!lake) for (let x = 0; x < W; x++) if ((x * 3 + (t >> 1)) % 11 < 4) set(x, seaTop, foam);
  }

  // trees, back to front
  const leaf = rgba(P.tree), leaf2 = rgba(P.tree2), trunk = rgba(P.trunk);
  const kind = o.view.trees;
  for (const tree of L.trees) {
    const gust = Math.sin(t * 0.35 + tree.x * 0.12) + 0.6 * Math.sin(t * 0.9 + tree.x * 0.31 + tree.phase);
    const lean = gust > 0.8 ? 1 : gust < -1.2 ? -1 : 0, hard = Math.abs(gust) > 1.3;
    const tall = TRUNK[kind][tree.size];
    if (kind === "palm") {
      for (let i = 0; i < tall; i++) set(tree.x + (i > tall / 2 ? 1 : 0), tree.base - i, trunk);
      const hx = tree.x + 1, hy = tree.base - tall;
      FRONDS.forEach(([dx, dy], i) => set(hx + dx + (Math.abs(dx) > 1 ? lean : 0), hy + dy + (hard && Math.abs(dx) === 3 ? 1 : 0), i % 3 ? leaf : leaf2));
      continue;
    }
    for (let i = 0; i < tall; i++) set(tree.x, tree.base - i, trunk);
    const rows = CANOPY[kind][tree.size], crown = tree.base - tall - rows.length + 1;
    rows.forEach(([dx, width], r) => {
      const shift = r < rows.length / 2 ? lean : hard ? lean : 0;
      for (let i = 0; i < width; i++) set(tree.x + dx + i + shift, crown + r, r === 0 || i === 0 ? leaf2 : leaf);
    });
  }

  if (o.cast) {
    const c = creature(o.cast.id), body = rgba(c.color), eye = rgba("#141414");
    const x0 = W - 16, y0 = HZ - 6;
    for (let y = 0; y < 6; y++) for (let x = 0; x < 4; x++) {
      if (!c.cells[y][x]) continue;
      set(x0 + x, y0 + y, body);
      set(x0 + 6 - x, y0 + y, body);
    }
    legs(c, o.cast.walking && ((t >> 1) & 1) === 1).forEach((x) => { set(x0 + x, y0 + 6, body); set(x0 + x, y0 + 7, body); });
    set(x0 + 2, y0 + 2, eye);
    set(x0 + 4, y0 + 2, eye);
    if (c.smile) set(x0 + 3, y0 + 4, eye);
  }
  ctx.putImageData(img, 0, 0);
}
