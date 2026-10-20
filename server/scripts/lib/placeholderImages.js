// Minimal PNG rasteriser used by the seeder to create illustrative listing
// images and brand assets without external files or native dependencies.
import zlib from 'node:zlib';

const hex = (h) => [1, 3, 5].map((i) => Number.parseInt(h.slice(i, i + 2), 16));
const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));

export class Canvas {
  constructor(width, height, background = '#ffffff') {
    this.width = width;
    this.height = height;
    this.data = Buffer.alloc(width * height * 4);
    if (background) this.fillRect(0, 0, width, height, background);
  }

  setPixel(x, y, rgb, alpha = 1) {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return;
    const i = (Math.floor(y) * this.width + Math.floor(x)) * 4;
    if (this.data[i + 3] === 0) {
      // Transparent pixel: take the colour and use alpha as coverage.
      this.data[i] = rgb[0];
      this.data[i + 1] = rgb[1];
      this.data[i + 2] = rgb[2];
      this.data[i + 3] = Math.round(Math.min(alpha, 1) * 255);
    } else if (alpha >= 1) {
      this.data[i] = rgb[0];
      this.data[i + 1] = rgb[1];
      this.data[i + 2] = rgb[2];
      this.data[i + 3] = 255;
    } else {
      this.data[i] = Math.round(this.data[i] * (1 - alpha) + rgb[0] * alpha);
      this.data[i + 1] = Math.round(this.data[i + 1] * (1 - alpha) + rgb[1] * alpha);
      this.data[i + 2] = Math.round(this.data[i + 2] * (1 - alpha) + rgb[2] * alpha);
      this.data[i + 3] = 255;
    }
  }

  fillRect(x, y, w, h, color, alpha = 1) {
    const rgb = typeof color === 'string' ? hex(color) : color;
    for (let yy = Math.max(0, Math.floor(y)); yy < Math.min(this.height, y + h); yy += 1) {
      for (let xx = Math.max(0, Math.floor(x)); xx < Math.min(this.width, x + w); xx += 1) this.setPixel(xx, yy, rgb, alpha);
    }
  }

  verticalGradient(x, y, w, h, top, bottom) {
    const a = hex(top);
    const b = hex(bottom);
    for (let yy = 0; yy < h; yy += 1) this.fillRect(x, y + yy, w, 1, mix(a, b, yy / Math.max(h - 1, 1)));
  }

  fillCircle(cx, cy, r, color, alpha = 1) {
    const rgb = hex(color);
    for (let y = Math.floor(cy - r); y <= cy + r; y += 1) {
      for (let x = Math.floor(cx - r); x <= cx + r; x += 1) {
        const d = Math.hypot(x - cx, y - cy);
        if (d <= r) this.setPixel(x, y, rgb, alpha * Math.min(1, r - d + 0.5));
      }
    }
  }

  fillPolygon(points, color, alpha = 1) {
    const rgb = hex(color);
    const ys = points.map((p) => p[1]);
    const minY = Math.max(0, Math.floor(Math.min(...ys)));
    const maxY = Math.min(this.height - 1, Math.ceil(Math.max(...ys)));
    for (let y = minY; y <= maxY; y += 1) {
      const xs = [];
      for (let i = 0; i < points.length; i += 1) {
        const [x1, y1] = points[i];
        const [x2, y2] = points[(i + 1) % points.length];
        if ((y1 <= y + 0.5 && y2 > y + 0.5) || (y2 <= y + 0.5 && y1 > y + 0.5)) {
          xs.push(x1 + ((y + 0.5 - y1) / (y2 - y1)) * (x2 - x1));
        }
      }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) this.fillRect(Math.round(xs[k]), y, Math.round(xs[k + 1]) - Math.round(xs[k]), 1, rgb, alpha);
    }
  }

  roundedRect(x, y, w, h, r, color, alpha = 1) {
    this.fillRect(x + r, y, w - 2 * r, h, color, alpha);
    this.fillRect(x, y + r, r, h - 2 * r, color, alpha);
    this.fillRect(x + w - r, y + r, r, h - 2 * r, color, alpha);
    for (const [cx, cy] of [[x + r, y + r], [x + w - r - 1, y + r], [x + r, y + h - r - 1], [x + w - r - 1, y + h - r - 1]]) {
      this.fillCircle(cx, cy, r, color, alpha);
    }
  }

  toPng() {
    const raw = Buffer.alloc((this.width * 4 + 1) * this.height);
    for (let y = 0; y < this.height; y += 1) {
      raw[y * (this.width * 4 + 1)] = 0;
      this.data.copy(raw, y * (this.width * 4 + 1) + 1, y * this.width * 4, (y + 1) * this.width * 4);
    }
    const chunk = (type, body) => {
      const len = Buffer.alloc(4);
      len.writeUInt32BE(body.length);
      const typeBuf = Buffer.from(type, 'ascii');
      const crc = Buffer.alloc(4);
      crc.writeUInt32BE(zlib.crc32(Buffer.concat([typeBuf, body])) >>> 0);
      return Buffer.concat([len, typeBuf, body, crc]);
    };
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(this.width, 0);
    ihdr.writeUInt32BE(this.height, 4);
    ihdr[8] = 8; // bit depth
    ihdr[9] = 6; // RGBA
    return Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      chunk('IHDR', ihdr),
      chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
      chunk('IEND', Buffer.alloc(0)),
    ]);
  }
}

// Deterministic pseudo-random generator so seeds are reproducible.
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const PALETTES = [
  { skyTop: '#7fb8e6', skyBottom: '#d9ecf7', hill: '#6f9f5a', ground: '#7fae62', wall: '#f3e9d8', roof: '#9c4a2f', trim: '#5b3a29' },
  { skyTop: '#f0a868', skyBottom: '#fbe1c3', hill: '#5d8a4e', ground: '#6e9b57', wall: '#ece4d6', roof: '#3d4f5c', trim: '#2c3a44' },
  { skyTop: '#5f9fd4', skyBottom: '#cfe6f5', hill: '#4f8a55', ground: '#5f9a5c', wall: '#ffffff', roof: '#0f4c5c', trim: '#0b3742' },
  { skyTop: '#9cc5e8', skyBottom: '#eef6fb', hill: '#7aa463', ground: '#86b26b', wall: '#e8d5bd', roof: '#7b3b2a', trim: '#4a2a20' },
];

function landscape(c, p, r) {
  c.verticalGradient(0, 0, c.width, c.height, p.skyTop, p.skyBottom);
  c.fillCircle(c.width * (0.75 + r() * 0.15), c.height * 0.18, c.height * 0.07, '#fff6d5', 0.9);
  // Rolling hills (Rwanda: land of a thousand hills).
  for (let i = 0; i < 3; i += 1) {
    const base = c.height * (0.55 + i * 0.06);
    const pts = [[0, c.height]];
    for (let x = 0; x <= c.width; x += 20) pts.push([x, base - Math.sin((x / c.width) * Math.PI * (1.5 + i) + r() * 0.2 + i) * c.height * 0.06]);
    pts.push([c.width, c.height]);
    c.fillPolygon(pts, i === 2 ? p.ground : p.hill, i === 2 ? 1 : 0.55 + i * 0.15);
  }
}

function tree(c, x, y, s) {
  c.fillRect(x - s * 0.06, y - s * 0.4, s * 0.12, s * 0.4, '#5b4030');
  c.fillCircle(x, y - s * 0.55, s * 0.3, '#3f7a3a');
  c.fillCircle(x - s * 0.18, y - s * 0.45, s * 0.2, '#4b8a43');
}

function windowGrid(c, x, y, cols, rows, w, h, gap, color) {
  for (let i = 0; i < cols; i += 1) for (let j = 0; j < rows; j += 1) c.fillRect(x + i * (w + gap), y + j * (h + gap), w, h, color);
}

/** Render an illustrative property picture. kind: house | apartment | land | office | shop | warehouse */
export function propertyImage(kind, seed = 1, width = 960, height = 640) {
  const r = rng(seed * 7919 + kind.length);
  const p = PALETTES[seed % PALETTES.length];
  const c = new Canvas(width, height);
  landscape(c, p, r);
  const groundY = height * 0.78;
  const cx = width / 2 + (r() - 0.5) * width * 0.1;

  if (kind === 'house') {
    const w = width * 0.42;
    const h = height * 0.26;
    c.fillRect(cx - w / 2, groundY - h, w, h, p.wall);
    c.fillPolygon([[cx - w / 2 - 20, groundY - h], [cx, groundY - h - height * 0.17], [cx + w / 2 + 20, groundY - h]], p.roof);
    c.fillRect(cx - 28, groundY - h * 0.55, 56, h * 0.55, p.trim);
    windowGrid(c, cx - w / 2 + 30, groundY - h + 30, 2, 1, 60, 50, 24, '#9fd0ef');
    windowGrid(c, cx + w / 2 - 174, groundY - h + 30, 2, 1, 60, 50, 24, '#9fd0ef');
    c.fillRect(0, groundY, width, height - groundY, '#c9b79c');
  } else if (kind === 'apartment') {
    const w = width * 0.3;
    const h = height * 0.58;
    c.fillRect(cx - w / 2, groundY - h, w, h, p.wall);
    c.fillRect(cx - w / 2 - 10, groundY - h - 14, w + 20, 16, p.roof);
    windowGrid(c, cx - w / 2 + 22, groundY - h + 24, 4, 6, (w - 44 - 3 * 18) / 4, 34, 18, '#8cc4e6');
    c.fillRect(cx + w / 2 + 30, groundY - h * 0.6, w * 0.6, h * 0.6, mix(hex(p.wall), [180, 180, 180], 0.25));
    windowGrid(c, cx + w / 2 + 48, groundY - h * 0.6 + 20, 3, 4, 34, 28, 16, '#8cc4e6');
    c.fillRect(0, groundY, width, height - groundY, '#b9b2a6');
  } else if (kind === 'land') {
    c.fillRect(0, groundY - 20, width, height - groundY + 20, '#a07a4f');
    for (let x = width * 0.15; x < width * 0.85; x += 70) c.fillRect(x, groundY - 60, 8, 60, '#6b4a2b');
    c.fillRect(width * 0.15, groundY - 52, width * 0.7, 4, '#d9d2c3');
    c.fillRect(width * 0.15, groundY - 32, width * 0.7, 4, '#d9d2c3');
    c.roundedRect(cx - 90, groundY - 150, 180, 70, 8, '#ffffff');
    c.fillRect(cx - 4, groundY - 80, 8, 80, '#6b4a2b');
    c.fillRect(cx - 70, groundY - 130, 140, 10, p.roof);
    c.fillRect(cx - 50, groundY - 110, 100, 8, '#888888');
  } else if (kind === 'office') {
    const w = width * 0.36;
    const h = height * 0.62;
    c.fillRect(cx - w / 2, groundY - h, w, h, '#5e7f95');
    windowGrid(c, cx - w / 2 + 12, groundY - h + 14, 6, 9, (w - 24 - 5 * 8) / 6, (h - 40 - 8 * 8) / 9, 8, '#b9dcef');
    c.fillRect(cx - 40, groundY - 50, 80, 50, '#2c3a44');
    c.fillRect(0, groundY, width, height - groundY, '#a9a9a9');
  } else if (kind === 'shop') {
    const w = width * 0.6;
    const h = height * 0.28;
    c.fillRect(cx - w / 2, groundY - h, w, h, p.wall);
    for (let i = 0; i < 8; i += 1) c.fillRect(cx - w / 2 + (i * w) / 8, groundY - h - 24, w / 8, 30, i % 2 ? '#e0a526' : '#ffffff');
    windowGrid(c, cx - w / 2 + 24, groundY - h + 40, 3, 1, (w - 48 - 2 * 24) / 3, h - 40, 24, '#9fd0ef');
    c.fillRect(0, groundY, width, height - groundY, '#b5aa98');
  } else {
    const w = width * 0.62;
    const h = height * 0.3;
    c.fillRect(cx - w / 2, groundY - h, w, h, '#9aa7b0');
    c.fillPolygon([[cx - w / 2 - 10, groundY - h], [cx, groundY - h - 60], [cx + w / 2 + 10, groundY - h]], '#6b7a85');
    for (let i = 0; i < 3; i += 1) c.fillRect(cx - w / 2 + 40 + i * (w / 3), groundY - h * 0.7, w / 3 - 80, h * 0.7, '#59656e');
    c.fillRect(0, groundY, width, height - groundY, '#9b9b9b');
  }
  tree(c, width * 0.1, groundY + 6, height * 0.22);
  tree(c, width * 0.9, groundY + 10, height * 0.2);
  return c.toPng();
}

/** Wide promotional banner with brand colours. */
export function bannerImage(seed = 1, width = 1600, height = 500) {
  const c = new Canvas(width, height);
  const themes = [['#0f4c5c', '#1b7a8c'], ['#7a2e1f', '#c2553a'], ['#1f3b2d', '#3c7a52'], ['#2b2d6e', '#4c55b8']];
  const [a, b] = themes[seed % themes.length];
  c.verticalGradient(0, 0, width, height, a, b);
  for (let i = 0; i < 6; i += 1) c.fillCircle(width * (0.55 + i * 0.09), height * (0.2 + (i % 3) * 0.3), height * 0.25, '#ffffff', 0.05);
  // Skyline silhouette on the right.
  const base = height;
  let x = width * 0.55;
  const r = rng(seed + 3);
  while (x < width) {
    const w = 60 + r() * 90;
    const h = height * (0.25 + r() * 0.45);
    c.fillRect(x, base - h, w, h, '#000000', 0.18);
    windowGrid(c, x + 10, base - h + 14, Math.floor((w - 20) / 22), Math.floor((h - 20) / 30), 12, 16, 10, '#ffe7a3');
    x += w + 8;
  }
  c.fillRect(0, height - 8, width, 8, '#e0a526');
  return c.toPng();
}

/** Square brand mark: house with a keyhole on a deep teal tile. */
export function logoImage(size = 512) {
  const c = new Canvas(size, size, null);
  c.roundedRect(0, 0, size, size, Math.round(size * 0.18), '#0f4c5c');
  const s = size / 512;
  // Roof
  c.fillPolygon([[96 * s, 250 * s], [256 * s, 104 * s], [416 * s, 250 * s], [376 * s, 250 * s], [256 * s, 146 * s], [136 * s, 250 * s]], '#e0a526');
  // House body
  c.fillRect(150 * s, 240 * s, 212 * s, 170 * s, '#e0a526');
  // Keyhole
  c.fillCircle(256 * s, 300 * s, 34 * s, '#0f4c5c');
  c.fillPolygon([[236 * s, 312 * s], [276 * s, 312 * s], [292 * s, 392 * s], [220 * s, 392 * s]], '#0f4c5c');
  return c.toPng();
}
