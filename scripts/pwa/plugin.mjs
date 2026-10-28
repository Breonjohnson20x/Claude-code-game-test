// Vite plugin that makes the game installable and playable offline, with no files in public/:
//   - the web manifest and the procedural PNG icons (scripts/pwa/icon.mjs), served in dev and
//     emitted at build time under the configured base path;
//   - <link rel="manifest"> and the apple-touch-icon injected into index.html;
//   - dist/sw.js, built from scripts/pwa/sw.js with the list of every emitted file to precache.
// src/ui/pwa.js registers the service worker (production builds only).

import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { renderIcon, encodePNG } from './icon.mjs';

export const ICONS = [
  { file: 'icons/icon-192.png', size: 192, maskable: false },
  { file: 'icons/icon-512.png', size: 512, maskable: false },
  { file: 'icons/maskable-512.png', size: 512, maskable: true },
  { file: 'icons/apple-touch-icon.png', size: 180, maskable: true },
];

const THEME = '#070d18';

export function webManifest() {
  return {
    id: './',
    name: 'OmniStrategy: Empire of Elvia',
    short_name: 'OmniStrat',
    description: 'Command the War Room, walk the border in person, duel for the crown, and return to a world that remembers.',
    start_url: './',
    scope: './',
    display: 'standalone',
    orientation: 'any',
    background_color: THEME,
    theme_color: THEME,
    categories: ['games', 'entertainment'],
    icons: ICONS.filter((i) => i.file !== 'icons/apple-touch-icon.png').map((i) => ({
      src: i.file,
      sizes: `${i.size}x${i.size}`,
      type: 'image/png',
      purpose: i.maskable ? 'maskable' : 'any',
    })),
  };
}

const SW_TEMPLATE = fileURLToPath(new URL('./sw.js', import.meta.url));

/** Build the service worker source for a list of files (paths relative to the base). */
export function buildServiceWorker(files) {
  const precache = ['./', ...files.filter((f) => f !== 'sw.js')].sort();
  const version = createHash('sha256').update(precache.join('\n')).update(readFileSync(SW_TEMPLATE)).digest('hex').slice(0, 12);
  return readFileSync(SW_TEMPLATE, 'utf8')
    .replace('self.__ELVIA_VERSION__', JSON.stringify(version))
    .replace('self.__ELVIA_PRECACHE__', JSON.stringify(precache));
}

// The optional narrator's lazily loaded SDK chunks (the SDK and its dependencies, no game code)
// are large and useless offline (they need the network), so they are cached on first use instead
// of precached.
const isNarratorChunk = (file) =>
  file.type === 'chunk' &&
  file.isDynamicEntry &&
  file.moduleIds.every((id) => id.includes('/node_modules/')) &&
  file.moduleIds.some((id) => id.includes('/node_modules/@anthropic-ai/'));

export function elviaPwa() {
  let base = '/';
  const pngs = new Map();
  const png = (icon) => {
    if (!pngs.has(icon.file)) pngs.set(icon.file, encodePNG(icon.size, icon.size, renderIcon(icon.size, icon)));
    return pngs.get(icon.file);
  };

  return {
    name: 'elvia-pwa',
    enforce: 'post',
    configResolved(config) {
      base = config.base;
    },
    transformIndexHtml() {
      return [
        { tag: 'link', attrs: { rel: 'manifest', href: `${base}manifest.webmanifest` }, injectTo: 'head' },
        { tag: 'link', attrs: { rel: 'apple-touch-icon', href: `${base}icons/apple-touch-icon.png` }, injectTo: 'head' },
      ];
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const path = (req.url ?? '').split('?')[0];
        if (!path.startsWith(base)) return next();
        const rel = path.slice(base.length);
        if (rel === 'manifest.webmanifest') {
          res.setHeader('Content-Type', 'application/manifest+json');
          res.end(JSON.stringify(webManifest(), null, 2));
          return undefined;
        }
        const icon = ICONS.find((i) => i.file === rel);
        if (!icon) return next();
        res.setHeader('Content-Type', 'image/png');
        res.end(png(icon));
        return undefined;
      });
    },
    generateBundle(_options, bundle) {
      for (const icon of ICONS) this.emitFile({ type: 'asset', fileName: icon.file, source: png(icon) });
      this.emitFile({ type: 'asset', fileName: 'manifest.webmanifest', source: JSON.stringify(webManifest(), null, 2) });
      const files = Object.values(bundle)
        .filter((f) => !f.fileName.endsWith('.map') && !isNarratorChunk(f))
        .map((f) => f.fileName);
      this.emitFile({ type: 'asset', fileName: 'sw.js', source: buildServiceWorker(files) });
    },
  };
}
