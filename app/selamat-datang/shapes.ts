// Titik 3D untuk morph partikel. 24% titik pertama tiap bentuk = bagian aksen (warna hi-vis).
export const ACCENT_RATIO = 0.24;
type P = [number, number, number];
type Pt = [number, number];
type Rand = () => number;
type Shape = (accent: boolean, r: Rand) => P;

/** Acak ber-seed supaya bentuk selalu sama. */
function rng(seed: number): Rand {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

/** Titik di sepanjang garis (t = 0..1 menurut panjang). */
function along(poly: Pt[], t: number): Pt {
  const len = poly.slice(1).map((p, i) => Math.hypot(p[0] - poly[i][0], p[1] - poly[i][1]));
  let d = t * len.reduce((a, b) => a + b, 0);
  for (let i = 0; i < len.length; i++) {
    if (d <= len[i]) {
      const k = d / len[i];
      return [poly[i][0] + (poly[i + 1][0] - poly[i][0]) * k, poly[i][1] + (poly[i + 1][1] - poly[i][1]) * k];
    }
    d -= len[i];
  }
  return poly[poly.length - 1];
}

const helmet: Shape = (accent, r) => {
  if (accent) {
    // tiga rusuk di atas cangkang
    const x = (Math.floor(r() * 3) - 1) * 0.22 + (r() - 0.5) * 0.06;
    const a = Math.PI * (0.06 + r() * 0.88);
    return [x, Math.sin(a) * 0.96 - 0.22 - Math.abs(x) * 0.12, Math.cos(a) * 1.12];
  }
  if (r() < 0.3) {
    const a = r() * Math.PI * 2;
    const w = 1 + r() * (Math.sin(a) > 0 ? 0.34 : 0.12);
    return [Math.cos(a) * 0.9 * w, -0.24 - r() * 0.05, Math.sin(a) * 1.1 * w];
  }
  const y = r();
  const a = r() * Math.PI * 2;
  const s = Math.sqrt(1 - y * y);
  return [Math.cos(a) * s * 0.9, y * 0.9 - 0.22, Math.sin(a) * s * 1.1];
};

const tri: Pt[] = [[-0.95, -0.72], [-1, -0.82], [-0.92, -0.9], [0.92, -0.9], [1, -0.82], [0.95, -0.72], [0.08, 0.86], [0, 0.9], [-0.08, 0.86], [-0.95, -0.72]];
const hazard: Shape = (accent, r) => {
  const z = (r() - 0.5) * 0.3;
  if (accent) {
    if (r() < 0.22) {
      const a = r() * 6.283;
      const q = Math.sqrt(r()) * 0.11;
      return [Math.cos(a) * q, -0.6 + Math.sin(a) * q, z];
    }
    const t = r();
    return [(r() - 0.5) * (0.14 + t * 0.12), -0.36 + t * 0.7, z];
  }
  const [x, y] = along(tri, r());
  const k = 1 - r() * 0.13;
  return [x * k, (y + 0.3) * k - 0.3, z];
};

const lens: Shape = (accent, r) => {
  if (accent) {
    const a = r() * 6.283;
    const q = Math.sqrt(r()) * 0.5;
    return [-0.2 + Math.cos(a) * q, 0.22 + Math.sin(a) * q, 0.14 * (1 - (q * q) / 0.25)];
  }
  if (r() < 0.3) {
    const t = r();
    const a = r() * 6.283;
    return [0.28 + t * 0.66 + Math.cos(a) * 0.08, -0.28 - t * 0.66 + Math.cos(a) * 0.08, Math.sin(a) * 0.12];
  }
  const a = r() * 6.283;
  const b = r() * 6.283;
  const R = 0.66 + Math.cos(b) * 0.09;
  return [-0.2 + Math.cos(a) * R, 0.22 + Math.sin(a) * R, Math.sin(b) * 0.12];
};

const gear: Shape = (accent, r) => {
  const a = r() * 6.283;
  const z = (r() - 0.5) * 0.36;
  if (accent) {
    const q = 0.3 + r() * 0.08;
    return [Math.cos(a) * q, Math.sin(a) * q, z];
  }
  const edge = 0.86 + 0.2 * Math.max(-0.5, Math.min(0.5, Math.sin(a * 9) * 2));
  const q = r() < 0.6 ? edge : 0.5 + r() * (edge - 0.5);
  return [Math.cos(a) * q, Math.sin(a) * q, z];
};

const shieldPoly: Pt[] = [[0, 1], [0.35, 0.84], [0.8, 0.74], [0.8, 0.1], [0.72, -0.25], [0.5, -0.62], [0.25, -0.86], [0, -1], [-0.25, -0.86], [-0.5, -0.62], [-0.72, -0.25], [-0.8, 0.1], [-0.8, 0.74], [-0.35, 0.84], [0, 1]];
const check: Pt[] = [[-0.4, 0.02], [-0.1, -0.3], [0.42, 0.36]];
const shield: Shape = (accent, r) => {
  if (accent) {
    const [x, y] = along(check, r());
    return [x + (r() - 0.5) * 0.12, y + (r() - 0.5) * 0.12, 0.2 + (r() - 0.5) * 0.12];
  }
  const [x, y] = along(shieldPoly, r());
  const k = r() < 0.65 ? 1 - r() * 0.08 : Math.sqrt(r());
  return [x * k, y * k, 0.2 * (1 - k * k) + (r() - 0.5) * 0.14];
};

/** Urutan = urutan elemen [data-shape] di halaman. */
export const SHAPES: Shape[] = [helmet, hazard, lens, gear, shield];

export function buildShapes(n: number): Float32Array[] {
  return SHAPES.map((shape, s) => {
    const r = rng(97 + s * 31);
    const out = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) out.set(shape(i < n * ACCENT_RATIO, r), i * 3);
    return out;
  });
}
