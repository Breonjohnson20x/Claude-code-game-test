// Installable, offline-capable build. Registers the service worker that scripts/pwa/plugin.mjs
// emits (production builds only) and keeps the browser's install prompt, so the title screen can
// offer "Install on this device" (Chrome, Edge, Android) or explain Add to Home Screen (iOS).

import { useSyncExternalStore } from 'react';

let deferredPrompt = null;
const listeners = new Set();

const isStandalone = () => Boolean(globalThis.matchMedia?.('(display-mode: standalone)').matches || globalThis.navigator?.standalone === true);

const isIos = () => {
  const nav = globalThis.navigator;
  if (!nav) return false;
  return /iPad|iPhone|iPod/.test(nav.userAgent ?? '') || (nav.platform === 'MacIntel' && nav.maxTouchPoints > 1);
};

function compute() {
  const installed = isStandalone();
  return { canPrompt: Boolean(deferredPrompt) && !installed, installed, iosHint: isIos() && !installed };
}

let snapshot = compute();
const emit = () => {
  snapshot = compute();
  for (const fn of listeners) fn();
};

/** Call once at startup (src/main.jsx). */
export function initPwa() {
  if (typeof window === 'undefined') return;
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt = event;
    emit();
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    emit();
  });
  if (import.meta.env.PROD && 'serviceWorker' in navigator) {
    // After the first load settles, so precaching doesn't compete with it. A slow remote font
    // can hold back the load event indefinitely, hence the timer as well.
    let registered = false;
    const register = () => {
      if (registered) return;
      registered = true;
      navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {});
    };
    if (document.readyState === 'complete') register();
    else {
      window.addEventListener('load', register, { once: true });
      setTimeout(register, 4000);
    }
  }
}

/** Show the browser's install dialog. Resolves true when the player accepted. */
export async function promptInstall() {
  const prompt = deferredPrompt;
  if (!prompt) return false;
  deferredPrompt = null;
  emit();
  prompt.prompt();
  const choice = await prompt.userChoice.catch(() => null);
  return choice?.outcome === 'accepted';
}

const subscribe = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

/** { canPrompt, installed, iosHint } */
export function useInstallState() {
  return useSyncExternalStore(subscribe, () => snapshot, () => snapshot);
}
