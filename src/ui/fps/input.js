// Input for the first-person mode: keyboard and mouse (pointer lock), touch (a floating stick,
// drag-to-look and on-screen buttons) and gamepad, all folded into the one input record the
// simulation reads. Held things are booleans; presses (jump, reload, …) fire once.

const PRESSES = ['jump', 'reload', 'swap', 'pulse', 'melee', 'interact'];

const KEYS = {
  KeyW: 'fwd',
  ArrowUp: 'fwd',
  KeyS: 'back',
  ArrowDown: 'back',
  KeyA: 'left',
  ArrowLeft: 'left',
  KeyD: 'right',
  ArrowRight: 'right',
  ShiftLeft: 'sprint',
  ShiftRight: 'sprint',
  ControlLeft: 'crouchHold',
  KeyF: 'ward',
};
const KEY_PRESS = { Space: 'jump', KeyR: 'reload', KeyQ: 'pulse', KeyV: 'melee', KeyE: 'interact', KeyX: 'swap' };

export const DEFAULT_SETTINGS = Object.freeze({ sensitivity: 1, invertY: false, quality: null, difficulty: 'soldier', aimAssist: true });

/**
 * createInput({ element, getSettings, onPause, onLockLost, onAnyKey })
 * read(dt) → the input record for this frame (and clears the presses).
 */
export function createInput({ element, getSettings, onPause, onLockLost, onAnyKey }) {
  const held = {};
  const press = {};
  const look = { yaw: 0, pitch: 0 };
  const touch = { stickId: null, sx: 0, sy: 0, mx: 0, my: 0, lookId: null, lx: 0, ly: 0, buttons: new Map() };
  let weaponWanted = null;
  let crouchToggle = false;
  let adsToggle = false;
  let locked = false;
  let everLocked = false;
  let enabled = false;
  let usedTouch = false;
  let padPrev = {};

  const sens = () => getSettings().sensitivity ?? 1;
  const inv = () => (getSettings().invertY ? -1 : 1);

  function applyLook(dx, dy, scale) {
    look.yaw -= dx * scale;
    look.pitch -= dy * scale * inv();
    look.pitch = Math.max(-1.45, Math.min(1.45, look.pitch));
  }

  const onKeyDown = (e) => {
    if (e.code === 'Escape' || e.code === 'KeyP') {
      onPause?.();
      return;
    }
    onAnyKey?.(e.code);
    if (!enabled) return;
    if (e.code === 'Tab' || e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
    if (e.repeat) return;
    if (KEYS[e.code]) held[KEYS[e.code]] = true;
    if (KEY_PRESS[e.code]) press[KEY_PRESS[e.code]] = true;
    if (e.code === 'KeyC') crouchToggle = !crouchToggle;
    if (e.code === 'Digit1') weaponWanted = 'carbine';
    if (e.code === 'Digit2') weaponWanted = 'lance';
  };
  const onKeyUp = (e) => {
    if (KEYS[e.code]) held[KEYS[e.code]] = false;
  };
  const onMouseMove = (e) => {
    if (!enabled || !locked) return;
    applyLook(e.movementX, e.movementY, 0.0022 * sens() * (held.ads ? 0.6 : 1));
  };
  const onMouseDown = (e) => {
    if (!enabled) return;
    if (!locked && !usedTouch) lock();
    if (e.button === 0) held.fire = true;
    if (e.button === 2) held.ads = true;
    if (e.button === 1) press.melee = true;
  };
  const onMouseUp = (e) => {
    if (e.button === 0) held.fire = false;
    if (e.button === 2) held.ads = false;
  };
  const onWheel = () => {
    if (enabled) press.swap = true;
  };
  const onContext = (e) => e.preventDefault();
  const onLockChange = () => {
    const now = document.pointerLockElement === element;
    if (locked && !now && enabled) onLockLost?.(); // Esc took the pointer back: pause, never un-pause
    locked = now;
    if (now) everLocked = true;
  };
  const onBlur = () => {
    for (const k of Object.keys(held)) held[k] = false;
  };

  function lock() {
    try {
      const r = element.requestPointerLock?.();
      if (r && typeof r.catch === 'function') r.catch(() => {});
    } catch {
      // no pointer lock here (touch devices, automation): the game still runs
    }
  }
  function unlock() {
    try {
      if (document.pointerLockElement) document.exitPointerLock();
    } catch {
      // nothing to release
    }
  }

  // ── touch: left half is a floating stick, the rest drags the view ─────────
  const onPointerDown = (e) => {
    if (e.pointerType === 'mouse' || !enabled) return;
    usedTouch = true;
    const rect = element.getBoundingClientRect();
    const x = e.clientX - rect.left;
    if (x < rect.width * 0.42 && touch.stickId == null) {
      touch.stickId = e.pointerId;
      touch.sx = e.clientX;
      touch.sy = e.clientY;
      touch.mx = 0;
      touch.my = 0;
    } else if (touch.lookId == null) {
      touch.lookId = e.pointerId;
      touch.lx = e.clientX;
      touch.ly = e.clientY;
    }
  };
  const onPointerMove = (e) => {
    if (e.pointerType === 'mouse') return;
    if (e.pointerId === touch.stickId) {
      const R = 56;
      let dx = (e.clientX - touch.sx) / R;
      let dy = (e.clientY - touch.sy) / R;
      const l = Math.hypot(dx, dy);
      if (l > 1) {
        dx /= l;
        dy /= l;
      }
      touch.mx = dx;
      touch.my = dy;
    } else if (e.pointerId === touch.lookId || touch.buttons.has(e.pointerId)) {
      const b = touch.buttons.get(e.pointerId);
      const lx = b ? b.lx : touch.lx;
      const ly = b ? b.ly : touch.ly;
      if (enabled) applyLook(e.clientX - lx, e.clientY - ly, 0.0052 * sens() * (held.ads || adsToggle ? 0.55 : 1));
      if (b) {
        b.lx = e.clientX;
        b.ly = e.clientY;
      } else {
        touch.lx = e.clientX;
        touch.ly = e.clientY;
      }
    }
  };
  const onPointerUp = (e) => {
    if (e.pointerId === touch.stickId) {
      touch.stickId = null;
      touch.mx = 0;
      touch.my = 0;
    }
    if (e.pointerId === touch.lookId) touch.lookId = null;
  };

  /** On-screen buttons call these. A held button also drags the view (fire and look with one thumb). */
  const api = {
    buttonDown(name, e) {
      usedTouch = true;
      if (e) touch.buttons.set(e.pointerId, { name, lx: e.clientX, ly: e.clientY });
      if (PRESSES.includes(name)) press[name] = true;
      else if (name === 'crouch') crouchToggle = !crouchToggle;
      else if (name === 'ads') adsToggle = !adsToggle;
      else held[name] = true;
    },
    buttonUp(name, e) {
      if (e) touch.buttons.delete(e.pointerId);
      if (!PRESSES.includes(name) && name !== 'crouch' && name !== 'ads') held[name] = false;
    },
  };

  function readPad() {
    const pads = globalThis.navigator?.getGamepads?.() ?? [];
    const pad = [...pads].find((p) => p && p.connected);
    if (!pad) return null;
    const dz = (v) => (Math.abs(v) < 0.16 ? 0 : (v - Math.sign(v) * 0.16) / 0.84);
    const b = (i) => !!pad.buttons[i]?.pressed;
    const edge = (i, name) => {
      const now = b(i);
      if (now && !padPrev[i]) press[name] = true;
      padPrev[i] = now;
    };
    edge(0, 'jump');
    edge(2, 'reload');
    edge(3, 'swap');
    edge(5, 'pulse');
    edge(11, 'melee');
    edge(1, 'interact');
    const start = b(9);
    if (start && !padPrev.start) onPause?.();
    padPrev.start = start;
    const crouchNow = b(13);
    if (crouchNow && !padPrev.crouch) crouchToggle = !crouchToggle;
    padPrev.crouch = crouchNow;
    return { mx: dz(pad.axes[0] ?? 0), my: dz(pad.axes[1] ?? 0), lx: dz(pad.axes[2] ?? 0), ly: dz(pad.axes[3] ?? 0), fire: (pad.buttons[7]?.value ?? 0) > 0.3, ads: (pad.buttons[6]?.value ?? 0) > 0.3, ward: b(4), sprint: b(10) };
  }

  function read(dt) {
    let moveX = (held.right ? 1 : 0) - (held.left ? 1 : 0);
    let moveZ = (held.fwd ? 1 : 0) - (held.back ? 1 : 0);
    let sprint = !!held.sprint;
    let fire = !!held.fire;
    let ads = !!held.ads || adsToggle;
    let ward = !!held.ward;
    if (touch.stickId != null) {
      moveX = touch.mx;
      moveZ = -touch.my;
      sprint = sprint || touch.my < -0.92;
    }
    const pad = enabled ? readPad() : null;
    if (pad) {
      if (Math.abs(pad.mx) + Math.abs(pad.my) > 0) {
        moveX = pad.mx;
        moveZ = -pad.my;
      }
      applyLook(pad.lx * Math.abs(pad.lx), pad.ly * Math.abs(pad.ly), 2.6 * sens() * dt * (pad.ads ? 0.5 : 1));
      fire = fire || pad.fire;
      ads = ads || pad.ads;
      ward = ward || pad.ward;
      sprint = sprint || pad.sprint;
    }
    const inp = {
      moveX,
      moveZ,
      yaw: look.yaw,
      pitch: look.pitch,
      fire,
      ads,
      ward,
      sprint,
      crouch: crouchToggle || !!held.crouchHold,
      jump: !!press.jump,
      reload: !!press.reload,
      swap: !!press.swap,
      weapon: weaponWanted,
      pulse: !!press.pulse,
      melee: !!press.melee,
      interact: !!press.interact,
    };
    if (inp.jump) crouchToggle = false;
    for (const k of PRESSES) press[k] = false;
    weaponWanted = null;
    return inp;
  }

  const doc = element.ownerDocument;
  const win = doc.defaultView;
  win.addEventListener('keydown', onKeyDown);
  win.addEventListener('keyup', onKeyUp);
  win.addEventListener('blur', onBlur);
  doc.addEventListener('mousemove', onMouseMove);
  element.addEventListener('mousedown', onMouseDown);
  win.addEventListener('mouseup', onMouseUp);
  element.addEventListener('wheel', onWheel, { passive: true });
  element.addEventListener('contextmenu', onContext);
  doc.addEventListener('pointerlockchange', onLockChange);
  element.addEventListener('pointerdown', onPointerDown);
  win.addEventListener('pointermove', onPointerMove);
  win.addEventListener('pointerup', onPointerUp);
  win.addEventListener('pointercancel', onPointerUp);

  return {
    ...api,
    read,
    look,
    lock,
    unlock,
    /** Push the view (recoil climb). */
    kick(pitch, yaw) {
      look.pitch = Math.min(1.45, look.pitch + pitch);
      look.yaw += yaw;
    },
    setLook(yaw, pitch) {
      look.yaw = yaw;
      look.pitch = pitch;
    },
    setEnabled(v) {
      enabled = v;
      if (!v) onBlur();
    },
    get locked() {
      return locked;
    },
    get everLocked() {
      return everLocked;
    },
    get touch() {
      return usedTouch;
    },
    stick: () => (touch.stickId != null ? { x: touch.sx, y: touch.sy, dx: touch.mx, dy: touch.my } : null),
    state: () => ({ crouch: crouchToggle, ads: adsToggle }),
    dispose() {
      unlock();
      win.removeEventListener('keydown', onKeyDown);
      win.removeEventListener('keyup', onKeyUp);
      win.removeEventListener('blur', onBlur);
      doc.removeEventListener('mousemove', onMouseMove);
      element.removeEventListener('mousedown', onMouseDown);
      win.removeEventListener('mouseup', onMouseUp);
      element.removeEventListener('wheel', onWheel);
      element.removeEventListener('contextmenu', onContext);
      doc.removeEventListener('pointerlockchange', onLockChange);
      element.removeEventListener('pointerdown', onPointerDown);
      win.removeEventListener('pointermove', onPointerMove);
      win.removeEventListener('pointerup', onPointerUp);
      win.removeEventListener('pointercancel', onPointerUp);
    },
  };
}
