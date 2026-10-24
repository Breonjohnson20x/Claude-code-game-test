// Player settings (Master Build §37 accessibility, §18/§29 optional AI with cost control).
// Stored only in this browser. The API key never leaves the device except in direct calls
// to the Anthropic API that the player turned on.

import { DEFAULT_MODEL } from '../../game/ai/client.js';
import { DEFAULT_AI_BUDGET } from '../../game/ai/cache.js';

export const SETTINGS_KEY = 'elvia.settings.v1';

export const TEXT_SIZES = [
  { id: 'small', label: 'Small' },
  { id: 'normal', label: 'Standard' },
  { id: 'large', label: 'Large' },
  { id: 'xlarge', label: 'Extra large' },
];

export const MODEL_OPTIONS = [
  { id: 'claude-opus-5-5', label: 'Claude Opus 5.5 (richest prose)' },
  { id: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5 (balanced)' },
  { id: 'claude-haiku-5-5', label: 'Claude Haiku 5.5 (fastest, cheapest)' },
];

export const DEFAULT_SETTINGS = Object.freeze({
  textSize: 'normal',
  reducedMotion: 'system', // 'system' | 'on' | 'off'
  muted: false,
  volume: 0.7,
  haptics: true,
  aiEnabled: false,
  apiKey: '',
  model: DEFAULT_MODEL,
  aiBudget: DEFAULT_AI_BUDGET,
  showHints: true,
});

function storage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export function loadSettings() {
  const ls = storage();
  if (!ls) return { ...DEFAULT_SETTINGS };
  try {
    const raw = JSON.parse(ls.getItem(SETTINGS_KEY) ?? 'null');
    if (!raw || typeof raw !== 'object') return { ...DEFAULT_SETTINGS };
    const merged = { ...DEFAULT_SETTINGS };
    for (const k of Object.keys(DEFAULT_SETTINGS)) if (raw[k] !== undefined && typeof raw[k] === typeof DEFAULT_SETTINGS[k]) merged[k] = raw[k];
    return merged;
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings) {
  const ls = storage();
  if (!ls) return;
  try {
    ls.setItem(SETTINGS_KEY, JSON.stringify(settings));
    ls.setItem('elvia.haptics', settings.haptics ? 'on' : 'off');
  } catch {
    // storage full or blocked: settings still apply for this session
  }
}

/** Reflect accessibility settings on <html> so theme.css can respond. */
export function applyDocumentSettings(settings) {
  const root = globalThis.document?.documentElement;
  if (!root) return;
  if (settings.textSize && settings.textSize !== 'normal') root.dataset.textSize = settings.textSize;
  else delete root.dataset.textSize;
  if (settings.reducedMotion === 'on') root.dataset.motion = 'reduced';
  else if (settings.reducedMotion === 'off') root.dataset.motion = 'full';
  else delete root.dataset.motion;
}

export function prefersReducedMotion(settings) {
  if (settings?.reducedMotion === 'on') return true;
  if (settings?.reducedMotion === 'off') return false;
  try {
    return globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  } catch {
    return false;
  }
}
