#!/usr/bin/env node
// Pack OmniStrat's docs and source into one Markdown file you can paste or upload into another
// LLM (ChatGPT, Gemini, a fresh Claude chat) when you want it to work on the game.
//
//   npm run bundle                 # list the bundles and their sizes
//   npm run bundle -- docs         # every doc (start here; ~smallest)
//   npm run bundle -- game         # docs + all game logic (src/game)
//   npm run bundle -- ui           # docs + the React UI (src/ui, styles, App)
//   npm run bundle -- duel         # docs + the duel engine and duel UI
//   npm run bundle -- all          # everything (large)
//   npm run bundle -- game --no-tests
//
// Output: context-bundles/omnistrat-<name>.md (git-ignored). Sizes are estimated at ~4 chars/token.

import { readdirSync, readFileSync, statSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join, relative, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'context-bundles');

const DOCS = ['docs/HANDOFF.md', 'AGENTS.md', 'README.md', 'docs'];
const BUNDLES = {
  docs: { about: 'Every doc: handoff, design digest, game guide, content, API, duel, saves/AI, UI, art, testing.', paths: DOCS },
  game: { about: 'Docs + all game logic (rules, content, duel engine, saves, AI narrator).', paths: [...DOCS, 'src/game'] },
  ui: { about: 'Docs + the React UI, styles and app shell.', paths: [...DOCS, 'src/App.jsx', 'src/main.jsx', 'src/index.css', 'src/styles', 'src/ui', 'index.html'] },
  duel: { about: 'Docs + the duel engine and duel UI.', paths: [...DOCS, 'src/game/duel', 'src/ui/duel', 'src/game/content/expedition.js'] },
  all: { about: 'Everything except lockfiles and generated output.', paths: [...DOCS, 'src', 'scripts', 'index.html', 'package.json', 'vite.config.js', 'eslint.config.js', '.claude/skills'] },
};

const TEXT_EXT = new Set(['.md', '.js', '.jsx', '.mjs', '.css', '.html', '.json']);
const LANG = { '.js': 'js', '.jsx': 'jsx', '.mjs': 'js', '.css': 'css', '.html': 'html', '.json': 'json', '.md': 'markdown' };

function walk(rel, files, { noTests }) {
  const abs = join(ROOT, rel);
  if (!existsSync(abs)) return;
  const st = statSync(abs);
  if (st.isDirectory()) {
    for (const name of readdirSync(abs).sort()) {
      if (name === 'node_modules' || name.startsWith('.')) continue;
      walk(join(rel, name), files, { noTests });
    }
    return;
  }
  if (!TEXT_EXT.has(extname(rel))) return;
  if (noTests && /\.test\.[jm]?js$/.test(rel)) return;
  files.add(relative(ROOT, abs));
}

function collect(name, opts) {
  const files = new Set();
  for (const p of BUNDLES[name].paths) walk(p, files, opts);
  return [...files];
}

function fence(text) {
  // Use a fence longer than any backtick run inside the file.
  const longest = Math.max(2, ...(text.match(/`+/g) ?? []).map((m) => m.length));
  return '`'.repeat(longest + 1);
}

function gitInfo() {
  try {
    const head = execSync('git log -1 --format="%h %s (%cs)"', { cwd: ROOT, encoding: 'utf8' }).trim();
    const branch = execSync('git rev-parse --abbrev-ref HEAD', { cwd: ROOT, encoding: 'utf8' }).trim();
    return `${branch} @ ${head}`;
  } catch {
    return 'unknown revision';
  }
}

function build(name, opts) {
  const files = collect(name, opts);
  const tree = files.map((f) => `- ${f}`).join('\n');
  let body = '';
  for (const f of files) {
    const text = readFileSync(join(ROOT, f), 'utf8');
    const fc = fence(text);
    body += `\n\n## File: ${f}\n\n${fc}${LANG[extname(f)] ?? ''}\n${text.replace(/\s+$/, '')}\n${fc}\n`;
  }
  const header = `# OmniStrat context bundle: ${name}

${BUNDLES[name].about}
Revision: ${gitInfo()}. Files: ${files.length}.

How to use this file with an AI assistant: upload or paste it, then say what you want changed.
Read "docs/HANDOFF.md" and "AGENTS.md" below first. They hold the project rules: the simulation owns
the truth, logic stays deterministic, the game must work with zero AI, all art is procedural, and
the UI is mobile-first. Ask for complete replacement files or unified diffs with the file path
on each one, so the changes can be applied to the repository.

## Files in this bundle

${tree}
`;
  return header + body;
}

const argv = process.argv.slice(2);
const opts = { noTests: argv.includes('--no-tests') };
const name = argv.find((a) => !a.startsWith('--'));

if (!name || !BUNDLES[name]) {
  console.log('Usage: npm run bundle -- <name> [--no-tests]\n');
  for (const [k, b] of Object.entries(BUNDLES)) {
    const chars = collect(k, opts).reduce((n, f) => n + statSync(join(ROOT, f)).size, 0);
    console.log(`  ${k.padEnd(5)}  ~${Math.round(chars / 4 / 1000)}k tokens  ${b.about}`);
  }
  process.exit(name ? 1 : 0);
}

mkdirSync(OUT, { recursive: true });
const text = build(name, opts);
const file = join(OUT, `omnistrat-${name}${opts.noTests ? '-no-tests' : ''}.md`);
writeFileSync(file, text);
console.log(`Wrote ${relative(ROOT, file)} — ${collect(name, opts).length} files, ~${Math.round(text.length / 4 / 1000)}k tokens.`);
