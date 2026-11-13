/* The skylines that the board can draw, and how it picks one for a place.
   Each shape is a hand-made outline: "x,h" pairs, both 0 to 100, left to right. */

export type Trees = "pine" | "round" | "palm" | "acacia" | "umbrella" | "shrub";
export type Front = "sea" | "lake" | "land";

export interface View {
  id: string;
  /** Name of the mountain. Empty for a made-up range. */
  name: string;
  /** Town or region that the mountain belongs to. */
  place: string;
  pts: string | null;
  /** Part of the height that carries snow, from the top. */
  snow: number;
  /** How rough the outline is. */
  jag: number;
  trees: Trees;
  front: Front;
  rock?: "red";
  smoke?: boolean;
  /** Part of the view's width that the mountain takes. Cones are narrow. */
  span?: number;
  /** Height against the tallest mountains, 0 to 1. */
  tall?: number;
}

interface Mountain extends View {
  lat: number;
  lon: number;
}

const m = (id: string, name: string, place: string, lat: number, lon: number, pts: string, snow: number, jag: number,
           trees: Trees, front: Front, extra: Partial<View> = {}): Mountain =>
  ({ id, name, place, lat, lon, pts, snow, jag, trees, front, ...extra });

export const MOUNTAINS: Mountain[] = [
  m("table-mountain", "Table Mountain", "Cape Town", -33.96, 18.41, "0,7 14,28 22,66 23,85 24,88 25,75 28,66 30,88 32,97 65,100 66,96 70,53 74,37 77,54 80,84 81,87 82,82 84,46 88,16 94,12 100,0", 0, 1, "umbrella", "sea"),
  m("drakensberg", "the Drakensberg", "Drakensberg", -28.75, 28.89, "0,20 8,30 12,44 14,56 16,60 34,62 50,61 66,62 82,60 84,56 86,62 87,72 88,62 90,48 94,36 100,24", 0, 2, "acacia", "land", { tall: 0.8 }),
  m("kilimanjaro", "Kilimanjaro", "Moshi", -3.07, 37.35, "0,0 10,6 22,22 32,44 38,56 42,60 58,60 62,56 68,44 74,34 78,30 81,40 83,34 85,42 88,28 94,10 100,0", 0.12, 1, "acacia", "land", { span: 0.8 }),
  m("mount-kenya", "Mount Kenya", "Nanyuki", -0.15, 37.31, "0,0 14,10 28,24 38,38 44,52 47,74 49,66 51,80 53,62 57,48 64,36 76,22 88,8 100,0", 0.1, 3, "acacia", "land", { span: 0.55 }),
  m("atlas", "the High Atlas", "Marrakech", 31.06, -7.92, "0,14 10,26 18,38 24,34 30,48 36,58 42,54 48,68 52,74 56,64 62,56 68,60 74,48 82,36 90,24 100,14", 0.3, 4, "palm", "land"),
  m("fuji", "Mount Fuji", "Tokyo", 35.36, 138.73, "0,0 18,8 34,30 44,62 48,78 52,78 56,62 66,30 82,8 100,0", 0.28, 1, "round", "lake", { span: 0.5 }),
  m("bukhansan", "Bukhansan", "Seoul", 37.66, 126.98, "0,4 12,14 22,26 30,36 36,50 40,62 43,56 46,70 49,66 52,74 55,60 60,46 68,34 78,22 90,10 100,4", 0, 3, "pine", "land", { tall: 0.75 }),
  m("lion-rock", "Lion Rock", "Hong Kong", 22.35, 114.19, "0,6 10,18 18,28 26,24 34,34 40,40 44,52 47,60 50,56 52,62 55,54 60,40 68,34 76,42 84,30 92,16 100,6", 0, 2, "palm", "sea", { tall: 0.7 }),
  m("everest", "Everest", "Kathmandu", 27.99, 86.93, "0,20 10,34 18,50 26,58 34,56 40,66 46,84 50,92 54,80 60,70 66,76 72,82 78,70 86,50 94,34 100,22", 0.6, 5, "pine", "land"),
  m("damavand", "Damavand", "Tehran", 35.95, 52.11, "0,4 14,12 28,26 38,44 45,64 49,78 51,78 55,64 62,44 72,26 86,12 100,4", 0.4, 2, "shrub", "land", { span: 0.5 }),
  m("ararat", "Ararat", "Yerevan", 39.7, 44.3, "0,0 8,6 16,16 22,30 27,44 30,48 33,44 38,30 43,22 48,26 54,42 60,62 65,78 68,82 71,78 76,62 82,42 90,20 100,4", 0.35, 2, "shrub", "land", { span: 0.65 }),
  m("olympus", "Mount Olympus", "Thessaloniki", 40.09, 22.36, "0,4 10,16 20,30 28,44 34,56 38,52 42,66 46,74 49,68 52,76 56,64 62,54 70,40 80,26 90,12 100,4", 0.15, 4, "umbrella", "sea"),
  m("etna", "Etna", "Catania", 37.75, 14.99, "0,0 14,8 28,22 38,38 45,54 49,62 51,62 55,54 62,38 72,22 86,8 100,0", 0.2, 2, "umbrella", "sea", { smoke: true, span: 0.55 }),
  m("vesuvius", "Vesuvius", "Naples", 40.82, 14.43, "0,0 12,8 24,22 32,38 38,50 42,54 46,46 50,44 54,56 58,62 62,56 68,42 76,26 86,10 100,0", 0, 1, "umbrella", "sea", { span: 0.55, tall: 0.8 }),
  m("matterhorn", "the Matterhorn", "Zermatt", 45.98, 7.66, "0,6 14,14 26,22 36,30 42,44 46,62 49,84 51,90 53,78 57,58 62,44 70,34 80,26 90,16 100,8", 0.35, 4, "pine", "land", { span: 0.55 }),
  m("mont-blanc", "Mont Blanc", "Geneva", 45.83, 6.86, "0,10 8,24 12,40 15,30 19,48 22,36 27,54 34,62 42,76 50,84 58,82 66,70 74,54 84,34 92,20 100,10", 0.55, 3, "pine", "lake"),
  m("arthurs-seat", "Arthur's Seat", "Edinburgh", 55.94, -3.16, "0,0 10,6 18,22 24,30 26,18 32,14 40,22 48,40 54,58 58,66 62,60 68,44 76,26 86,12 100,0", 0, 2, "round", "sea", { span: 0.6, tall: 0.6 }),
  m("teide", "Teide", "Tenerife", 28.27, -16.64, "0,10 10,18 20,22 30,24 38,30 44,48 48,66 50,72 52,66 56,48 62,30 70,24 80,22 90,18 100,10", 0.1, 2, "palm", "sea", { span: 0.6 }),
  m("rainier", "Mount Rainier", "Seattle", 46.85, -121.76, "0,0 12,10 24,28 34,52 42,70 47,80 53,82 58,74 64,62 72,46 82,24 92,8 100,0", 0.45, 3, "pine", "sea", { span: 0.6 }),
  m("hood", "Mount Hood", "Portland", 45.37, -121.7, "0,0 20,12 36,36 44,60 49,82 51,84 54,70 60,48 70,28 84,10 100,0", 0.4, 3, "pine", "lake", { span: 0.5 }),
  m("lions", "The Lions", "Vancouver", 49.46, -123.19, "0,6 10,18 20,30 28,38 34,34 40,46 44,62 46,56 48,66 51,50 58,42 66,48 74,40 84,26 92,14 100,6", 0.15, 3, "pine", "sea"),
  m("denali", "Denali", "Anchorage", 63.07, -151.01, "0,8 12,20 22,36 32,58 40,74 46,86 50,84 54,90 60,80 68,62 78,40 88,22 100,8", 0.7, 4, "pine", "land", { span: 0.65 }),
  m("half-dome", "Half Dome", "Yosemite", 37.75, -119.53, "0,8 10,16 20,22 30,26 38,30 44,40 48,58 51,72 55,78 60,78 62,74 63,40 64,30 72,26 82,20 92,12 100,8", 0, 2, "pine", "land", { span: 0.6 }),
  m("front-range", "the Front Range", "Denver", 40.25, -105.62, "0,10 8,22 14,34 20,30 26,44 32,52 36,48 42,60 46,70 52,70 56,58 62,50 68,56 74,46 80,36 86,40 92,26 100,12", 0.3, 4, "pine", "land"),
  m("diamond-head", "Diamond Head", "Honolulu", 21.26, -157.81, "0,0 8,6 16,16 24,24 30,30 36,34 44,36 54,36 62,38 68,44 72,50 75,46 80,34 86,20 92,8 100,0", 0, 2, "palm", "sea", { tall: 0.6 }),
  m("popocatepetl", "Popocatépetl", "Mexico City", 19.02, -98.62, "0,6 6,14 12,24 18,30 24,34 30,32 36,28 42,22 48,20 54,26 60,40 66,58 70,70 72,72 74,70 78,58 84,40 90,24 100,8", 0.25, 2, "shrub", "land", { smoke: true, span: 0.7 }),
  m("sugarloaf", "Sugarloaf", "Rio de Janeiro", -22.95, -43.16, "0,0 6,10 12,22 18,26 24,20 30,12 36,8 40,14 43,40 45,62 48,72 52,72 55,60 57,36 60,14 66,8 74,18 80,34 84,44 88,36 94,16 100,4", 0, 1, "palm", "sea", { tall: 0.8 }),
  m("andes", "the Andes", "Santiago", -33.35, -70.25, "0,24 6,36 12,50 16,44 22,58 28,70 32,62 38,74 44,84 48,78 54,88 60,76 66,68 72,74 78,60 84,50 90,54 96,40 100,30", 0.5, 5, "shrub", "land"),
  m("fitz-roy", "Fitz Roy", "El Chaltén", -49.27, -73.04, "0,10 10,18 20,24 28,30 33,44 36,40 39,56 42,50 45,70 47,86 49,92 51,84 53,66 56,58 59,64 62,50 68,38 76,30 86,20 100,10", 0.3, 4, "round", "lake", { span: 0.6 }),
  m("uluru", "Uluru", "Uluru", -25.34, 131.04, "0,0 6,2 10,14 13,24 18,28 30,29 50,30 70,29 82,28 87,24 90,14 94,2 100,0", 0, 1, "shrub", "land", { rock: "red", span: 0.5, tall: 0.45 }),
  m("three-sisters", "the Three Sisters", "Sydney", -33.73, 150.31, "0,30 12,32 20,34 24,34 25,48 27,52 29,48 30,36 32,36 33,54 35,58 37,54 38,38 40,38 41,50 43,54 45,50 46,36 56,36 70,34 84,32 100,30", 0, 2, "round", "land", { tall: 0.6 }),
  m("aoraki", "Aoraki", "Aoraki", -43.59, 170.14, "0,8 12,20 22,34 30,48 36,58 41,70 45,84 48,90 51,82 55,72 60,66 66,56 74,42 84,26 92,14 100,8", 0.6, 4, "shrub", "lake", { span: 0.6 }),
];

/* A rough place for each common time zone. Used only when the browser gives no location. */
const ZONES = "Africa/Johannesburg:-26.2,28.05;Africa/Cairo:30.04,31.24;Africa/Lagos:6.52,3.38;Africa/Nairobi:-1.29,36.82;Africa/Casablanca:33.57,-7.59;Africa/Accra:5.6,-0.19;Africa/Addis_Ababa:9.03,38.74;Africa/Dar_es_Salaam:-6.79,39.21;America/New_York:40.71,-74.01;America/Chicago:41.88,-87.63;America/Denver:39.74,-104.99;America/Los_Angeles:34.05,-118.24;America/Phoenix:33.45,-112.07;America/Anchorage:61.22,-149.9;America/Toronto:43.65,-79.38;America/Vancouver:49.28,-123.12;America/Edmonton:53.55,-113.49;America/Halifax:44.65,-63.58;America/Mexico_City:19.43,-99.13;America/Bogota:4.71,-74.07;America/Lima:-12.05,-77.04;America/Sao_Paulo:-23.55,-46.63;America/Argentina/Buenos_Aires:-34.6,-58.38;America/Santiago:-33.45,-70.67;Pacific/Honolulu:21.31,-157.86;Pacific/Auckland:-36.85,174.76;Atlantic/Canary:28.12,-15.43;Atlantic/Reykjavik:64.15,-21.94;Europe/London:51.51,-0.13;Europe/Dublin:53.35,-6.26;Europe/Paris:48.86,2.35;Europe/Berlin:52.52,13.4;Europe/Madrid:40.42,-3.7;Europe/Rome:41.9,12.5;Europe/Zurich:47.38,8.54;Europe/Vienna:48.21,16.37;Europe/Amsterdam:52.37,4.9;Europe/Brussels:50.85,4.35;Europe/Stockholm:59.33,18.07;Europe/Oslo:59.91,10.75;Europe/Copenhagen:55.68,12.57;Europe/Helsinki:60.17,24.94;Europe/Warsaw:52.23,21.01;Europe/Prague:50.08,14.44;Europe/Budapest:47.5,19.04;Europe/Bucharest:44.43,26.1;Europe/Athens:37.98,23.73;Europe/Istanbul:41.01,28.98;Europe/Lisbon:38.72,-9.14;Europe/Kyiv:50.45,30.52;Europe/Moscow:55.76,37.62;Asia/Tokyo:35.68,139.69;Asia/Seoul:37.57,126.98;Asia/Shanghai:31.23,121.47;Asia/Hong_Kong:22.32,114.17;Asia/Taipei:25.03,121.57;Asia/Singapore:1.35,103.82;Asia/Kolkata:28.61,77.21;Asia/Kathmandu:27.72,85.32;Asia/Dhaka:23.81,90.41;Asia/Karachi:24.86,67.0;Asia/Dubai:25.2,55.27;Asia/Riyadh:24.71,46.68;Asia/Tehran:35.69,51.39;Asia/Yerevan:40.18,44.51;Asia/Tbilisi:41.72,44.83;Asia/Jerusalem:31.77,35.21;Asia/Bangkok:13.76,100.5;Asia/Ho_Chi_Minh:10.82,106.63;Asia/Jakarta:-6.21,106.85;Asia/Manila:14.6,120.98;Australia/Sydney:-33.87,151.21;Australia/Melbourne:-37.81,144.96;Australia/Brisbane:-27.47,153.03;Australia/Adelaide:-34.93,138.6;Australia/Perth:-31.95,115.86;Australia/Darwin:-12.46,130.84";

const zoneOf = new Map<string, [number, number]>(
  ZONES.split(";").map((entry) => {
    const [zone, place] = entry.split(":");
    const [lat, lon] = place.split(",").map(Number);
    return [zone, [lat, lon]];
  }),
);

/** A mountain counts as "of the region" inside this distance. */
const REGION_KM = 350;

function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const rad = Math.PI / 180;
  const a = Math.sin(((lat2 - lat1) * rad) / 2) ** 2 +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(((lon2 - lon1) * rad) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(a));
}

/** A made-up range in the style of a latitude: palms near the equator, pines and snow far from it. */
function madeUp(lat: number | null): View {
  const far = Math.abs(lat ?? 45);
  if (far < 15) return { id: "range-tropical", name: "", place: "", pts: null, snow: 0, jag: 2, trees: "palm", front: "sea" };
  if (far < 32) return { id: "range-dry", name: "", place: "", pts: null, snow: 0, jag: 2, trees: "acacia", front: "land" };
  if (far < 48) return { id: "range-temperate", name: "", place: "", pts: null, snow: 0.1, jag: 2, trees: "round", front: "lake" };
  if (far < 60) return { id: "range-north", name: "", place: "", pts: null, snow: 0.3, jag: 3, trees: "pine", front: "lake" };
  return { id: "range-far-north", name: "", place: "", pts: null, snow: 0.6, jag: 3, trees: "pine", front: "sea" };
}

export interface Place {
  lat: number | null;
  lon: number | null;
  skyline: string;
}

/** The view for a place: a named mountain of the region, or a made-up range. */
export function chooseView(place: Place, zone: string): View {
  const named = MOUNTAINS.find((x) => x.id === place.skyline);
  if (named) return named;
  let spot: [number, number] | null = place.lat !== null && place.lon !== null ? [place.lat, place.lon] : zoneOf.get(zone) || null;
  if (place.skyline === "hills" || place.skyline === "random") return madeUp(spot ? spot[0] : null);
  if (!spot) return madeUp(null);
  let best: Mountain | null = null, bestKm = REGION_KM;
  for (const x of MOUNTAINS) {
    const km = distanceKm(spot[0], spot[1], x.lat, x.lon);
    if (km < bestKm) { best = x; bestKm = km; }
  }
  return best || madeUp(spot[0]);
}

/** Heights 0 to 1 for `width` columns. A named mountain keeps its shape; the rest changes with the seed. */
export function profile(view: View, width: number, rnd: () => number): number[] {
  const out = new Array<number>(width).fill(0);
  const span = (view.span || 0.72) * (0.94 + rnd() * 0.12), left = (1 - span) * (0.35 + rnd() * 0.3);
  let pts: [number, number][];
  if (view.pts) {
    pts = view.pts.split(" ").map((p) => p.split(",").map(Number) as [number, number]);
  } else {
    // two to four peaks at random places
    pts = [[0, 4 + rnd() * 10]];
    const peaks = 2 + Math.floor(rnd() * 3);
    for (let i = 0; i < peaks; i++) {
      const x = ((i + 0.5 + (rnd() - 0.5) * 0.5) / peaks) * 100;
      pts.push([x - 8 - rnd() * 6, 22 + rnd() * 18], [x, 55 + rnd() * 45], [x + 8 + rnd() * 6, 22 + rnd() * 18]);
    }
    pts.push([100, 4 + rnd() * 10]);
    pts.sort((a, b) => a[0] - b[0]);
  }
  const highest = Math.max(...pts.map((pt) => pt[1])), scale = (view.tall || 1) / highest;
  const rough = Array.from({ length: 24 }, () => rnd() - 0.5);
  for (let x = 0; x < width; x++) {
    const t = ((x / width - left) / span) * 100;
    if (t < 0 || t > 100) continue;
    let i = 0;
    while (i < pts.length - 2 && pts[i + 1][0] < t) i++;
    const [x0, h0] = pts[i], [x1, h1] = pts[i + 1];
    const f = x1 > x0 ? Math.min(1, Math.max(0, (t - x0) / (x1 - x0))) : 0;
    const smooth = view.pts ? f : f * f * (3 - 2 * f);
    const base = h0 + (h1 - h0) * smooth;
    const at = (t / 100) * (rough.length - 1), k = Math.floor(at);
    const noise = rough[k] + (rough[Math.min(rough.length - 1, k + 1)] - rough[k]) * (at - k);
    out[x] = Math.max(0, (base + noise * view.jag * (base > 6 ? 1 : 0)) * scale);
  }
  return out;
}
