import { describe, expect, it } from 'vitest';
import { inflateSync } from 'node:zlib';
import { encodePNG, renderIcon } from './icon.mjs';
import { buildServiceWorker, ICONS, webManifest } from './plugin.mjs';

function readPNG(buf) {
  expect([...buf.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  const idatLen = buf.readUInt32BE(33);
  const raw = inflateSync(buf.subarray(41, 41 + idatLen));
  return { width, height, raw };
}

const pixel = (rgba, size, x, y) => [...rgba.subarray((y * size + x) * 4, (y * size + x) * 4 + 4)];

describe('app icon', () => {
  it('encodes a valid RGBA PNG that round-trips', () => {
    const rgba = Buffer.from([255, 0, 0, 255, 0, 255, 0, 128, 0, 0, 255, 0, 9, 9, 9, 9]);
    const { width, height, raw } = readPNG(encodePNG(2, 2, rgba));
    expect([width, height]).toEqual([2, 2]);
    expect([...raw]).toEqual([0, ...rgba.subarray(0, 8), 0, ...rgba.subarray(8)]);
  });

  it('draws a rounded tile with transparent corners, and a full-bleed maskable variant', () => {
    const size = 64;
    const tile = renderIcon(size);
    const mask = renderIcon(size, { maskable: true });
    expect(pixel(tile, size, 0, 0)[3]).toBe(0);
    expect(pixel(tile, size, 32, 4)[3]).toBe(255);
    expect(pixel(mask, size, 0, 0)[3]).toBe(255);
    // The star at the centre is bright; the navy field is dark.
    const [r, g, b] = pixel(mask, size, 32, 32);
    expect(r + g + b).toBeGreaterThan(600);
    const [nr, ng, nb] = pixel(mask, size, 2, 62);
    expect(nr + ng + nb).toBeLessThan(120);
  });
});

describe('web manifest and service worker', () => {
  it('declares installable icons with relative URLs, so any base path works', () => {
    const m = webManifest();
    expect(m.start_url).toBe('./');
    expect(m.display).toBe('standalone');
    expect(m.icons.map((i) => `${i.sizes}:${i.purpose}`)).toEqual(['192x192:any', '512x512:any', '512x512:maskable']);
    for (const icon of m.icons) expect(icon.src.startsWith('/')).toBe(false);
    expect(ICONS.some((i) => i.file === 'icons/apple-touch-icon.png')).toBe(true);
  });

  it('fills the precache list and a content-derived version into the worker', () => {
    const files = ['assets/index-abc.js', 'index.html', 'sw.js', 'icons/icon-192.png'];
    const sw = buildServiceWorker(files);
    expect(sw).not.toContain('self.__ELVIA_PRECACHE__');
    expect(sw).not.toContain('self.__ELVIA_VERSION__');
    const list = JSON.parse(sw.match(/const PRECACHE = (\[.*?\])/)[1]);
    expect(list).toEqual(['./', 'assets/index-abc.js', 'icons/icon-192.png', 'index.html']);
    const version = (src) => src.match(/const VERSION = "([0-9a-f]+)"/)[1];
    expect(version(buildServiceWorker(files))).toBe(version(sw));
    expect(version(buildServiceWorker(['assets/index-def.js', 'index.html']))).not.toBe(version(sw));
  });
});
