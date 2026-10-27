// Generates the PWA PNG icons without any image dependency: a 4× supersampled
// signed-distance rasteriser + a minimal PNG encoder on top of node:zlib.
// Run: node scripts/gen-icons.mjs
import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const OUT = new URL('../public/', import.meta.url);
mkdirSync(OUT, { recursive: true });

const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const BG = hex('#0b1020');
const A = hex('#ff7a6b');
const B = hex('#58b8ff');
const LINK = hex('#c6cdf5');
const GOLD = hex('#f5c451');

const sdRoundBox = (x, y, cx, cy, hw, hh, r) => {
  const qx = Math.abs(x - cx) - hw + r;
  const qy = Math.abs(y - cy) - hh + r;
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
};

/** Scene in unit coordinates (0..1). `inset` shrinks content for maskable safe zone. */
function shade(u, v, { rounded, inset }) {
  // Background
  if (rounded && sdRoundBox(u, v, 0.5, 0.5, 0.5, 0.5, 0.22) > 0) return null;
  const s = 1 - inset * 2;
  const x = (u - inset) / s;
  const y = (v - inset) / s;
  let col = BG;
  // Dashed arc linking the boxes (upper semicircle between box centres)
  const cx = 0.5;
  const cy = 0.6;
  const R = 0.25;
  const d = Math.hypot(x - cx, y - cy);
  if (y < cy && Math.abs(d - R) < 0.028) {
    const ang = Math.atan2(cy - y, x - cx); // 0..π
    if (Math.floor((ang / Math.PI) * 9) % 2 === 0) col = LINK;
  }
  // Gold ring under B
  const gd = Math.hypot(x - 0.75, y - 0.6);
  if (Math.abs(gd - 0.17) < 0.022) col = GOLD;
  if (sdRoundBox(x, y, 0.25, 0.6, 0.13, 0.13, 0.045) < 0) col = A;
  if (sdRoundBox(x, y, 0.75, 0.6, 0.11, 0.11, 0.04) < 0) col = B;
  return col;
}

function render(size, opts) {
  const SS = 4;
  const px = Buffer.alloc(size * size * 4);
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const c = shade((i + (sx + 0.5) / SS) / size, (j + (sy + 0.5) / SS) / size, opts);
          if (!c) continue;
          r += c[0]; g += c[1]; b += c[2]; a += 1;
        }
      }
      const o = (j * size + i) * 4;
      if (a) {
        px[o] = r / a; px[o + 1] = g / a; px[o + 2] = b / a;
      }
      px[o + 3] = Math.round((a / (SS * SS)) * 255);
    }
  }
  return encodePng(size, size, px);
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function encodePng(w, h, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const jobs = [
  ['icon-192.png', 192, { rounded: true, inset: 0.06 }],
  ['icon-512.png', 512, { rounded: true, inset: 0.06 }],
  ['icon-maskable-512.png', 512, { rounded: false, inset: 0.16 }],
  ['apple-touch-icon.png', 180, { rounded: false, inset: 0.1 }],
];
for (const [name, size, opts] of jobs) {
  writeFileSync(new URL(name, OUT), render(size, opts));
  console.log('wrote', name);
}
