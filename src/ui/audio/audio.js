// TEMPORARY STUB — replaced by the ART/AUDIO worker. API per docs/ARCHITECTURE.md.
export const audio = {
  unlock() {},
  setMuted() {},
  setVolume() {},
  ambient() {},
  sfx() {},
};

export function haptic(pattern) {
  if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(pattern);
}

export default audio;
