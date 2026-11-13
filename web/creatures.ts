/* One small creature for each session, fixed by the session's id. It walks while its session works. */
import { CALM, el, hash, seeded } from "./util.js";

export interface Creature {
  cells: boolean[][];
  color: string;
  wide: boolean;
  smile: boolean;
}

const BODY = ["#d6523e", "#e09f3e", "#3a8f6a", "#2f7fd1", "#8a5fbf", "#c2557a", "#3fa0a0", "#7a8a3a"];
const known = new Map<string, Creature>();
let walkers: { canvas: HTMLCanvasElement; id: string }[] = [];

export function creature(id: string): Creature {
  const found = known.get(id);
  if (found) return found;
  const h = hash(id), rnd = seeded(h);
  const cells: boolean[][] = [];
  for (let y = 0; y < 6; y++) {
    cells.push([]);
    for (let x = 0; x < 4; x++) {
      let on: boolean;
      if (y >= 1 && y <= 4 && x >= 1) on = true;
      else if (y === 0) on = x >= 1 && rnd() < 0.4;
      else if (y === 5) on = x >= 1 && rnd() < 0.75;
      else on = rnd() < 0.5;
      cells[y][x] = on;
    }
  }
  if (!cells[5].some(Boolean)) cells[5][2] = true;
  const made = { cells, color: BODY[h % BODY.length], wide: rnd() < 0.5, smile: rnd() < 0.5 };
  known.set(id, made);
  return made;
}

/** The columns of the two legs. They swap inward and outward for the walk. */
export function legs(c: Creature, step: boolean): number[] {
  return (c.wide ? [1, 5] : [2, 4]).map((x, i) => (step ? x + (i ? -1 : 1) * (c.wide ? 1 : -1) : x));
}

export function drawCreature(canvas: HTMLCanvasElement, id: string, step: boolean): void {
  const c = creature(id), ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, 7, 8);
  ctx.fillStyle = c.color;
  for (let y = 0; y < 6; y++) for (let x = 0; x < 4; x++) {
    if (!c.cells[y][x]) continue;
    ctx.fillRect(x, y, 1, 1);
    ctx.fillRect(6 - x, y, 1, 1);
  }
  legs(c, step).forEach((x) => ctx.fillRect(x, 6, 1, 2));
  ctx.fillStyle = "#141414";
  ctx.fillRect(2, 2, 1, 1);
  ctx.fillRect(4, 2, 1, 1);
  if (c.smile) ctx.fillRect(3, 4, 1, 1);
}

export function sprite(id: string, scale: number, busy: boolean, mark: boolean): HTMLElement {
  const wrap = el("span", { class: "sprite" });
  const canvas = el("canvas", { width: "7", height: "8" });
  canvas.style.width = 7 * scale + "px";
  canvas.style.height = 8 * scale + "px";
  drawCreature(canvas, id, false);
  wrap.append(canvas);
  if (busy && !CALM) walkers.push({ canvas, id });
  if (mark) wrap.append(el("b", { class: "mark", text: "!", title: "New since you last opened it" }));
  return wrap;
}

export function stepWalkers(step: boolean): void {
  walkers = walkers.filter((w) => w.canvas.isConnected);
  walkers.forEach((w) => drawCreature(w.canvas, w.id, step));
}
