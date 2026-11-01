import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { deflateSync } from "node:zlib";

const outputDirectory = resolve("apps/extension/public/icon");
const sizes = [16, 32, 48, 128];

const colors = {
  navy: [23, 36, 61, 255],
  yellow: [255, 216, 77, 255],
  yellowDark: [245, 184, 46, 255],
  white: [248, 250, 252, 255],
  grey: [200, 210, 228, 255],
  transparent: [0, 0, 0, 0],
};

const insideRoundedRect = (x, y, left, top, right, bottom, radius) => {
  const nearestX = Math.max(left + radius, Math.min(x, right - radius));
  const nearestY = Math.max(top + radius, Math.min(y, bottom - radius));
  return Math.hypot(x - nearestX, y - nearestY) <= radius;
};

const insideCapsule = (x, y, startX, endX, centerY, radius) => {
  const nearestX = Math.max(startX, Math.min(x, endX));
  return Math.hypot(x - nearestX, y - centerY) <= radius;
};

const insideTriangle = (x, y, [a, b, c]) => {
  const sign = (p1, p2, p3) =>
    (p1[0] - p3[0]) * (p2[1] - p3[1]) -
    (p2[0] - p3[0]) * (p1[1] - p3[1]);
  const point = [x, y];
  const d1 = sign(point, a, b);
  const d2 = sign(point, b, c);
  const d3 = sign(point, c, a);
  return !(d1 < 0 || d2 < 0 || d3 < 0) || !(d1 > 0 || d2 > 0 || d3 > 0);
};

const markerCoordinates = (x, y) => {
  const angle = (42 * Math.PI) / 180;
  const offsetX = x - 64;
  const offsetY = y - 62;
  return [
    64 + offsetX * Math.cos(angle) - offsetY * Math.sin(angle),
    62 + offsetX * Math.sin(angle) + offsetY * Math.cos(angle),
  ];
};

const sample = (x, y) => {
  if (!insideRoundedRect(x, y, 16, 16, 112, 112, 23)) {
    return colors.transparent;
  }

  let color = colors.navy;
  if (insideCapsule(x, y, 31, 97, 88, 6)) color = colors.yellow;

  const [markerX, markerY] = markerCoordinates(x, y);
  if (insideRoundedRect(markerX, markerY, 53, 27, 75, 98, 7)) {
    color = markerY >= 72 ? colors.yellow : colors.white;
  }
  if (insideRoundedRect(markerX, markerY, 58, 34, 70, 62, 6)) {
    color = colors.grey;
  }
  if (
    insideTriangle(markerX, markerY, [
      [57, 98],
      [71, 98],
      [64, 108],
    ])
  ) {
    color = colors.yellowDark;
  }

  return color;
};

const crcTable = Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  return value >>> 0;
});

const crc32 = (buffer) => {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
};

const chunk = (type, data) => {
  const typeBuffer = Buffer.from(type);
  const size = Buffer.alloc(4);
  size.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])));
  return Buffer.concat([size, typeBuffer, data, checksum]);
};

const render = (size) => {
  const supersampling = size < 128 ? 4 : 3;
  const raw = Buffer.alloc((size * 4 + 1) * size);
  let offset = 0;

  for (let pixelY = 0; pixelY < size; pixelY += 1) {
    raw[offset] = 0;
    offset += 1;
    for (let pixelX = 0; pixelX < size; pixelX += 1) {
      const totals = [0, 0, 0, 0];
      for (let sampleY = 0; sampleY < supersampling; sampleY += 1) {
        for (let sampleX = 0; sampleX < supersampling; sampleX += 1) {
          const x = ((pixelX + (sampleX + 0.5) / supersampling) * 128) / size;
          const y = ((pixelY + (sampleY + 0.5) / supersampling) * 128) / size;
          const rgba = sample(x, y);
          const alpha = rgba[3] / 255;
          totals[0] += rgba[0] * alpha;
          totals[1] += rgba[1] * alpha;
          totals[2] += rgba[2] * alpha;
          totals[3] += rgba[3];
        }
      }
      const count = supersampling ** 2;
      const averageAlpha = totals[3] / count;
      const alphaScale = averageAlpha === 0 ? 0 : 255 / averageAlpha;
      raw[offset] = Math.round((totals[0] / count) * alphaScale);
      raw[offset + 1] = Math.round((totals[1] / count) * alphaScale);
      raw[offset + 2] = Math.round((totals[2] / count) * alphaScale);
      raw[offset + 3] = Math.round(averageAlpha);
      offset += 4;
    }
  }

  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8;
  header[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
};

await mkdir(outputDirectory, { recursive: true });
await Promise.all(
  sizes.map((size) => writeFile(resolve(outputDirectory, `${size}.png`), render(size))),
);
