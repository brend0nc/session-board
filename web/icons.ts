/* Pixel icons, drawn from small bitmaps. */
import { el } from "./util.js";

const ICONS: Record<string, string[]> = {
  chat: [".#######.", "#.......#", "#.#.#.#.#", "#.......#", ".#######.", "..##.....", "..#......"],
  next: ["....#....", "....##...", "#######..", "########.", "#######..", "....##...", "....#...."],
  done: ["........#", ".......##", "#.....##.", "##...##..", ".##.##...", "..###....", "...#....."],
  undo: ["..#......", ".##......", "#######..", ".##....#.", "..#....#.", ".......#.", "....###.."],
  close: ["#.....#", ".#...#.", "..#.#..", "...#...", "..#.#..", ".#...#.", "#.....#"],
  full: ["###...###", "#.......#", "#.......#", ".........", "#.......#", "#.......#", "###...###"],
  side: ["#########", "#.....#.#", "#.....#.#", "#.....#.#", "#.....#.#", "#.....#.#", "#########"],
  out: ["....####", "......##", ".....#.#", "###.#..#", "#..#....", "#......#", "#......#", "########"],
  wifi: ["..#######..", ".#.......#.", "#..#####..#", "..#.....#..", "....###....", "...#...#...", "...........", ".....#.....", "..........."],
  sun: ["....#....", ".#.....#.", "...###...", "..#####..", "#.#####.#", "..#####..", "...###...", ".#.....#.", "....#...."],
  moon: ["...####..", "..###....", ".###.....", ".###.....", ".###.....", ".####...#", "..######.", "...####.."],
  pencil: ["......#.", ".....###", "....###.", "...###..", "..###...", ".###....", "##......", "#......."],
  pin: ["..###..", ".#####.", ".##.##.", ".#####.", "..###..", "..###..", "...#...", "...#..."],
};

/* The wifi sign with a slash through it. The cells beside the slash are cleared, so the slash stays clear. */
ICONS.wifiOff = ICONS.wifi.map((row, y) => {
  const cells = [...row], x = y + 1;
  cells[x - 1] = ".";
  cells[x + 1] = ".";
  cells[x] = "#";
  return cells.join("");
});

export function icon(name: string): SVGSVGElement {
  const rows = ICONS[name], ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", "0 0 " + rows[0].length + " " + rows.length);
  svg.setAttribute("width", String(rows[0].length * 2));
  svg.setAttribute("height", String(rows.length * 2));
  svg.setAttribute("shape-rendering", "crispEdges");
  svg.setAttribute("aria-hidden", "true");
  rows.forEach((row, y) => [...row].forEach((ch, x) => {
    if (ch !== "#") return;
    const cell = document.createElementNS(ns, "rect");
    cell.setAttribute("x", String(x));
    cell.setAttribute("y", String(y));
    cell.setAttribute("width", "1");
    cell.setAttribute("height", "1");
    cell.setAttribute("fill", "currentColor");
    svg.append(cell);
  }));
  return svg;
}

/** An icon button. With `wide` it also shows its label; without, the label is the tooltip. */
export function iconButton(name: string, label: string, onclick: (() => void) | null, wide = false, href = ""): HTMLElement {
  const attrs = { class: "ib px" + (wide ? " wide" : ""), title: label, "aria-label": label };
  const btn = href ? el("a", { ...attrs, href }) : el("button", { ...attrs, type: "button" });
  btn.append(icon(name));
  if (wide) btn.append(label);
  if (onclick) btn.onclick = onclick;
  return btn;
}
