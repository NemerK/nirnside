#!/usr/bin/env node
/**
 * Regenerates nirnside.ico (repo root) from src/app/icon.svg.
 *
 * The .ico is committed: players never run this. It needs sharp, which is NOT a
 * project dependency so player installs never download it:
 *   npm install sharp --no-save && node scripts/make-icon.mjs
 */
import { readFile, writeFile } from "node:fs/promises";
import { argv } from "node:process";
import sharp from "sharp";

const SVG = "src/app/icon.svg";
const OUT = "nirnside.ico";
const DENSITY = 400;

const SIZES_BMP = [16, 24, 32, 48];
const SIZES_PNG = [64, 128, 256];

const svg = await readFile(SVG);

async function rgba(size) {
  return sharp(svg, { density: DENSITY }).resize(size, size).raw().toBuffer();
}

async function png(size) {
  return sharp(svg, { density: DENSITY }).resize(size, size).png().toBuffer();
}

/** Classic 32bpp BMP entry: BITMAPINFOHEADER + bottom-up BGRA + empty AND mask. */
function bmpEntry(size, rgbaBuf) {
  if (rgbaBuf.length !== size * size * 4) {
    throw new Error(`unexpected raw buffer size for ${size}px`);
  }
  const row = size * 4;
  const pixels = Buffer.alloc(row * size);
  for (let y = 0; y < size; y++) {
    const src = rgbaBuf.subarray(y * row, (y + 1) * row);
    const dst = pixels.subarray((size - 1 - y) * row, (size - y) * row);
    for (let x = 0; x < size; x++) {
      dst[x * 4 + 0] = src[x * 4 + 2];
      dst[x * 4 + 1] = src[x * 4 + 1];
      dst[x * 4 + 2] = src[x * 4 + 0];
      dst[x * 4 + 3] = src[x * 4 + 3];
    }
  }
  const maskRow = Math.ceil(size / 32) * 4;
  const mask = Buffer.alloc(maskRow * size);
  const header = Buffer.alloc(40);
  header.writeUInt32LE(40, 0);
  header.writeInt32LE(size, 4);
  header.writeInt32LE(size * 2, 8);
  header.writeUInt16LE(1, 12);
  header.writeUInt16LE(32, 14);
  header.writeUInt32LE(pixels.length + mask.length, 20);
  return Buffer.concat([header, pixels, mask]);
}

const images = [];
for (const size of SIZES_BMP) {
  images.push({ size, data: bmpEntry(size, await rgba(size)) });
}
for (const size of SIZES_PNG) {
  images.push({ size, data: await png(size) });
}

const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(images.length, 4);
let offset = 6 + 16 * images.length;
const dir = Buffer.alloc(16 * images.length);
images.forEach((img, i) => {
  const e = 16 * i;
  const dim = img.size >= 256 ? 0 : img.size;
  dir.writeUInt8(dim, e);
  dir.writeUInt8(dim, e + 1);
  dir.writeUInt8(0, e + 2);
  dir.writeUInt8(0, e + 3);
  dir.writeUInt16LE(1, e + 4);
  dir.writeUInt16LE(32, e + 6);
  dir.writeUInt32LE(img.data.length, e + 8);
  dir.writeUInt32LE(offset, e + 12);
  offset += img.data.length;
});

const ico = Buffer.concat([header, dir, ...images.map((i) => i.data)]);
await writeFile(OUT, ico);
// Keep the browser favicon (a Next file convention) in lockstep with the
// Windows shell icon so every surface shows the same mark.
await writeFile("src/app/favicon.ico", ico);

// Self-check: read it back and validate the container.
const back = await readFile(OUT);
if (back.readUInt16LE(0) !== 0 || back.readUInt16LE(2) !== 1) throw new Error("bad ico header");
if (back.readUInt16LE(4) !== images.length) throw new Error("bad ico count");
let cursor = 6;
for (const img of images) {
  const w = back.readUInt8(cursor) || 256;
  if (w !== img.size) throw new Error(`entry size mismatch: ${w} != ${img.size}`);
  cursor += 16;
}
console.log(`wrote ${OUT}: ${images.map((i) => i.size).join(", ")} px (${ico.length} bytes)`);

if (argv.includes("--preview")) {
  await sharp(svg, { density: DENSITY }).resize(32, 32).png().toFile("/tmp/icon-32.png");
  console.log("wrote /tmp/icon-32.png");
}
