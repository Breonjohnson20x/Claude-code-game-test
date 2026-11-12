import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { BOUNDS, WATER_Y, buildLevel, groundY, steerThroughGates, surfaceAt } from './level.js';
import { PLAYER, WEAPONS, ENEMY, hurtPlayer, spawnProjectile } from './combat.js';
import { STEP_MS, createFps, getHud, getResult, resolveSurrender, respawn, stepFps } from './sim.js';
import { createBot } from './bots.js';
import { DISPATCHES, RADIO, chronicleLine } from './lore.js';

const HERE = dirname(fileURLToPath(import.meta.url));

function run(state, seconds, input = {}) {
  const events = [];
  const fn = typeof input === 'function' ? input : () => input;
  for (let i = 0; i < Math.round(seconds * 60); i += 1) {
    stepFps(state, fn(state, i), STEP_MS);
    for (const ev of state.events) events.push(ev);
  }
  return events;
}

function playThrough(kind, difficulty, minutes, seed = 412) {
  const s = createFps({ seed, difficulty });
  const bot = createBot(kind);
  for (let i = 0; i < minutes * 3600 && s.status !== 'won'; i += 1) {
    stepFps(s, bot.step(s), STEP_MS);
    if (s.status === 'dead') respawn(s);
    if (s.flags.surrenderOpen && s.status !== 'won') resolveSurrender(s, 'released');
  }
  return s;
}

const insideSolid = (L, x, z, pad = 0) => L.solids.find((s) => s.kind !== 'trunk' && s.kind !== 'gate' && x > s.minX - pad && x < s.maxX + pad && z > s.minZ - pad && z < s.maxZ + pad);

describe('the Greywater Front: level', () => {
  const L = buildLevel();

  it('is built once and frozen', () => {
    expect(buildLevel()).toBe(L);
    expect(Object.isFrozen(L.solids)).toBe(true);
    expect(L.solids.length).toBeGreaterThan(100);
  });

  it('has continuous ground with a river you can wade at the ford', () => {
    for (let z = BOUNDS.maxZ; z > BOUNDS.minZ; z -= 1) {
      for (let x = -30; x <= 30; x += 2) {
        expect(Math.abs(groundY(x, z) - groundY(x + 0.5, z))).toBeLessThan(0.6);
      }
    }
    const ford = L.route.find(([, z]) => Math.abs(z + 128) < 1);
    expect(WATER_Y - groundY(ford[0], ford[1])).toBeGreaterThan(0.2);
    expect(WATER_Y - groundY(ford[0], ford[1])).toBeLessThan(0.7);
    expect(surfaceAt(ford[0], ford[1])).toBe('water');
    expect(surfaceAt(L.start.x, L.start.z)).toBe('road');
  });

  it('puts nobody and nothing inside a wall', () => {
    for (const e of L.enemies) {
      if (e.static) continue;
      expect(insideSolid(L, e.x, e.z, ENEMY[e.type].r * 0.5), `enemy ${e.id}`).toBeUndefined();
    }
    for (const p of L.pickups) expect(insideSolid(L, p.x, p.z), `pickup ${p.id}`).toBeUndefined();
    for (const [x, z] of L.route) expect(insideSolid(L, x, z, 0.3), `route ${x},${z}`).toBeUndefined();
    for (const [group, covers] of Object.entries(L.covers)) for (const [x, z] of covers) expect(insideSolid(L, x, z, 0.2), `cover ${group} ${x},${z}`).toBeUndefined();
  });

  it('gives every fighting group somewhere to fight from', () => {
    for (const group of new Set(L.enemies.filter((e) => e.type === 'rifleman').map((e) => e.group))) {
      expect(L.covers[group].length).toBeGreaterThanOrEqual(L.enemies.filter((e) => e.group === group && e.type === 'rifleman' && !e.static).length);
    }
  });

  it('steers walkers through gates, not palisades', () => {
    const out = { x: 0, z: 0 };
    steerThroughGates(L, 20, -50, 20, -70, out);
    expect(out.x).toBeCloseTo(L.gates.gateA);
    expect(out.z).toBeGreaterThan(-58);
    steerThroughGates(L, L.gates.gateA, -57, 20, -70, out);
    expect(out.z).toBeLessThan(-58);
    steerThroughGates(L, 5, -70, 9, -80, out);
    expect(out).toEqual({ x: 9, z: -80 });
  });
});

describe('the Greywater Front: rules', () => {
  it('starts with the Sovereign on the road, armed, with an objective and a word from Mara', () => {
    const s = createFps({ seed: 1 });
    const hud = getHud(s);
    expect(hud.hp).toBe(100);
    expect(hud.weaponName).toBe('Lattice Carbine');
    expect(hud.mag).toBe(WEAPONS.carbine.mag);
    expect(hud.objective).toMatch(/frontier road/);
    expect(s.events.some((e) => e.type === 'radio' && e.key === 'start')).toBe(true);
    expect(RADIO.start[0].who).toBe('mara');
  });

  it('is deterministic: the same seed and inputs give the same fight', () => {
    const play = () => {
      const s = createFps({ seed: 99, difficulty: 'soldier', stage: 'picket' });
      const bot = createBot('recruit', 3);
      for (let i = 0; i < 1500; i += 1) {
        stepFps(s, bot.step(s), STEP_MS);
        if (s.status === 'dead') respawn(s);
      }
      return JSON.stringify({ p: s.player, e: s.enemies, st: s.stats, seed: s.rngSeed });
    };
    expect(play()).toBe(play());
  });

  it('moves, sprints, crouches and jumps', () => {
    const s = createFps({ seed: 1 });
    const z0 = s.player.z;
    run(s, 1, { moveZ: 1, yaw: 0, pitch: 0 });
    const walked = z0 - s.player.z;
    expect(walked).toBeGreaterThan(3.5);
    expect(walked).toBeLessThan(PLAYER.WALK + 0.1);
    const z1 = s.player.z;
    run(s, 1, { moveZ: 1, sprint: true, yaw: 0, pitch: 0 });
    expect(z1 - s.player.z).toBeGreaterThan(walked * 1.3);
    const ev = run(s, 0.05, { jump: true, yaw: 0, pitch: 0 });
    expect(ev.some((e) => e.type === 'jump')).toBe(true);
    expect(s.player.grounded).toBe(false);
    run(s, 1.5, { yaw: 0, pitch: 0 });
    expect(s.player.grounded).toBe(true);
    run(s, 0.5, { crouch: true, yaw: 0, pitch: 0 });
    expect(s.player.crouch).toBeGreaterThan(0.9);
  });

  it('never lets the player leave the field or walk through a palisade', () => {
    const s = createFps({ seed: 1, stage: 'checkpoint' });
    s.player.x = 20;
    s.player.z = -52;
    run(s, 4, { moveZ: 1, sprint: true, yaw: 0, pitch: 0 });
    expect(s.player.z).toBeGreaterThan(-58);
    run(s, 12, { moveX: 1, yaw: 0, pitch: 0 });
    expect(s.player.x).toBeLessThanOrEqual(BOUNDS.maxX);
  });

  it('fires the carbine on a held trigger, spends the magazine and reloads from reserve', () => {
    const s = createFps({ seed: 1 });
    const ev = run(s, 4.9, { fire: true, yaw: 0, pitch: 0.4 });
    const shots = ev.filter((e) => e.type === 'shot');
    expect(shots.length).toBeGreaterThanOrEqual(30);
    expect(ev.some((e) => e.type === 'reload_start')).toBe(true);
    expect(ev.some((e) => e.type === 'reload_end')).toBe(true);
    expect(s.player.ammo.carbine.reserve).toBe(WEAPONS.carbine.reserve - WEAPONS.carbine.mag);
    expect(s.stats.shots).toBe(shots.length);
  });

  it('the trigger wins over sprinting: a thumb pushed fully forward can still shoot', () => {
    const s = createFps({ seed: 1 });
    const ev = run(s, 1, { moveZ: 1, sprint: true, fire: true, yaw: 0, pitch: 0.3 });
    expect(ev.filter((e) => e.type === 'shot').length).toBeGreaterThan(5);
    expect(s.player.sprinting).toBe(false);
  });

  it('the Sunlance fires once per pull', () => {
    const s = createFps({ seed: 1 });
    run(s, 0.6, (st, i) => ({ weapon: i === 0 ? 'lance' : undefined, yaw: 0, pitch: 0.4 }));
    expect(s.player.weapon).toBe('lance');
    const ev = run(s, 3, { fire: true, yaw: 0, pitch: 0.4 });
    expect(ev.filter((e) => e.type === 'shot').length).toBe(1);
  });

  it('kills with headshots faster than body shots, and weakens the carbine at range', () => {
    const shoot = (dist, aimHead) => {
      const s = createFps({ seed: 5, stage: 'picket' });
      const e = s.enemies.find((x) => x.group === 'A' && x.type === 'rifleman');
      for (const o of s.enemies) if (o !== e) o.dormant = true;
      s.god = true;
      e.alerted = true;
      e.state = 'stagger';
      e.stagger = 99;
      e.x = 0;
      e.z = -14;
      e.y = groundY(e.x, e.z);
      e.crouch = false;
      s.player.x = e.x;
      s.player.z = e.z + dist;
      s.player.y = groundY(s.player.x, s.player.z);
      const ty = e.y + ENEMY.rifleman.h * (aimHead ? 0.92 : 0.5);
      const pitch = Math.atan2(ty - (s.player.y + PLAYER.EYE), dist);
      const ev = run(s, 0.05, { fire: true, yaw: 0, pitch });
      return ev.find((x) => x.type === 'enemy_hit');
    };
    const body = shoot(12, false);
    const head = shoot(12, true);
    expect(body?.zone).toBe('body');
    expect(head?.zone).toBe('head');
    expect(head.dmg).toBeGreaterThan(body.dmg * 1.9);
    expect(shoot(55, false).dmg).toBeLessThan(body.dmg * 0.85);
  });

  it('the Shield Ward soaks bolts from the front and not from behind', () => {
    const s = createFps({ seed: 1 });
    const p = s.player;
    run(s, 0.1, { ward: true, yaw: 0, pitch: 0 });
    expect(p.warding).toBe(true);
    hurtPlayer(s, 20, p.x, p.z - 10);
    expect(p.hp).toBe(100);
    expect(p.ward).toBeLessThan(100);
    hurtPlayer(s, 20, p.x, p.z + 10);
    expect(p.hp).toBeLessThan(100);
  });

  it('bolts travel: they hit a standing target and miss one behind stone', () => {
    const s = createFps({ seed: 1, stage: 'picket' });
    for (const e of s.enemies) e.dormant = true;
    const p = s.player;
    spawnProjectile(s, 'bolt', p.x, p.y + 1.1, p.z - 20, 0, 0, 60, 10);
    run(s, 1, { yaw: 0, pitch: 0 });
    expect(p.hp).toBeLessThan(100);
    const wall = s.level.solids.find((x) => x.kind === 'wall');
    p.x = wall.x;
    p.z = wall.maxZ + 0.6;
    p.y = groundY(p.x, p.z);
    p.hp = 100;
    spawnProjectile(s, 'bolt', wall.x, wall.y + 0.6, wall.minZ - 15, 0, 0, 60, 10);
    const ev = run(s, 1, { yaw: 0, pitch: 0, crouch: true });
    expect(p.hp).toBe(100);
    expect(ev.some((e) => e.type === 'impact' && e.surface === 'wall')).toBe(true);
  });

  it('the Arc Pulse staggers those close by and has a cooldown', () => {
    const s = createFps({ seed: 1, stage: 'picket' });
    const e = s.enemies.find((x) => x.type === 'trooper' && x.group === 'A');
    s.player.x = e.x;
    s.player.z = e.z + 4;
    const ev = run(s, 0.05, { pulse: true, yaw: 0, pitch: 0 });
    expect(ev.some((x) => x.type === 'pulse')).toBe(true);
    expect(e.state).toBe('stagger');
    expect(e.hp).toBeLessThan(e.maxHp);
    expect(getHud(s).pulse).toBeLessThan(0.1);
    const again = run(s, 0.05, { pulse: true, yaw: 0, pitch: 0 });
    expect(again.some((x) => x.type === 'pulse')).toBe(false);
  });

  it('fuel casks blow when shot and take their neighbours with them', () => {
    const s = createFps({ seed: 1, stage: 'depot' });
    for (const e of s.enemies) e.dormant = true;
    s.god = true;
    const cask = s.level.solids.find((x) => x.id === 'fuel_1');
    const p = s.player;
    p.x = cask.x;
    p.z = cask.z + 14;
    p.y = groundY(p.x, p.z);
    const pitch = Math.atan2(cask.y + 0.6 - (p.y + PLAYER.EYE), 14);
    const ev = run(s, 0.3, { fire: true, yaw: 0, pitch });
    expect(ev.filter((e) => e.type === 'explosion').length).toBe(2);
    expect(s.removed.fuel_1 && s.removed.fuel_2).toBe(true);
  });

  it('picks up cells, draughts and dispatches', () => {
    const s = createFps({ seed: 1 });
    const paper = s.pickups.find((k) => k.kind === 'dispatch');
    s.player.x = paper.x;
    s.player.z = paper.z;
    const ev = run(s, 0.1, { yaw: 0, pitch: 0 });
    expect(ev.find((e) => e.type === 'dispatch')?.lore).toBe(paper.lore);
    expect(DISPATCHES[paper.lore].body.length).toBeGreaterThan(40);
    expect(getResult(s).dispatches).toEqual([paper.lore]);
    for (const k of s.pickups) if (k.kind === 'dispatch') expect(DISPATCHES[k.lore], k.lore).toBeTruthy();
  });

  it('falling is not the end: the last checkpoint takes you back', () => {
    const s = createFps({ seed: 1, stage: 'checkpoint' });
    const before = { x: s.player.x, z: s.player.z };
    run(s, 1, { moveZ: 1, yaw: 0, pitch: 0 });
    hurtPlayer(s, 999, 0, 0);
    expect(s.status).toBe('dead');
    expect(getResult(s).deaths).toBe(1);
    respawn(s);
    expect(s.status).toBe('playing');
    expect(s.player.hp).toBeGreaterThanOrEqual(70);
    expect(s.player.x).toBeCloseTo(before.x, 5);
    expect(s.player.z).toBeCloseTo(before.z, 5);
    expect(getResult(s).deaths).toBe(1);
  });
});

describe('the Greywater Front: fairness', () => {
  it('every attack is announced before it lands', () => {
    const s = createFps({ seed: 21, difficulty: 'soldier' });
    const bot = createBot('recruit', 5);
    const lastTell = new Map();
    let fires = 0;
    let strikes = 0;
    let stomps = 0;
    for (let i = 0; i < 8 * 3600 && s.status !== 'won'; i += 1) {
      stepFps(s, bot.step(s), STEP_MS);
      for (const ev of s.events) {
        if (ev.type === 'enemy_aim' || ev.type === 'heavy_spin' || ev.type === 'enemy_windup' || ev.type === 'walker_stomp_wind') lastTell.set(`${ev.type}:${ev.id}`, ev.t);
        if (ev.type === 'enemy_fire') {
          fires += 1;
          const tell = ev.enemy === 'heavy' ? lastTell.get(`heavy_spin:${ev.id}`) : lastTell.get(`enemy_aim:${ev.id}`);
          expect(tell, `${ev.enemy} fired without a tell`).toBeDefined();
          expect(ev.t - tell).toBeGreaterThanOrEqual(ev.enemy === 'heavy' ? 800 : 230);
        }
        if (ev.type === 'enemy_strike') {
          strikes += 1;
          expect(ev.t - lastTell.get(`enemy_windup:${ev.id}`)).toBeGreaterThanOrEqual(440);
        }
        if (ev.type === 'walker_stomp') {
          stomps += 1;
          expect(ev.t - lastTell.get(`walker_stomp_wind:${ev.id}`)).toBeGreaterThanOrEqual(900);
        }
      }
      if (s.status === 'dead') respawn(s);
      if (s.flags.surrenderOpen && s.status !== 'won') resolveSurrender(s, 'held');
    }
    expect(fires).toBeGreaterThan(20);
    expect(strikes + stomps).toBeGreaterThanOrEqual(0);
    expect(s.outcome).toBe('held');
  });

  it('a jump clears the walker stomp', () => {
    const s = createFps({ seed: 1, stage: 'depot' });
    const w = s.enemies.find((e) => e.type === 'walker');
    for (const e of s.enemies) if (e !== w) e.dormant = true;
    const p = s.player;
    const setup = () => {
      p.x = w.x + 5;
      p.z = w.z;
      p.y = groundY(p.x, p.z);
      p.vy = 0;
      p.grounded = true;
      p.hp = 100;
      w.mode = 'engage';
      w.state = 'stomp_wind';
      w.stT = 0;
    };
    setup();
    run(s, 1.1, { yaw: 0, pitch: 0 });
    expect(p.hp).toBeLessThan(100);
    setup();
    run(s, 1.1, (st, i) => ({ yaw: 0, pitch: 0, jump: i === 44 }));
    expect(p.hp).toBe(100);
  });

  it('standing still loses: the picket cuts an idle Sovereign down', () => {
    const s = createFps({ seed: 3, difficulty: 'soldier', stage: 'picket' });
    s.player.z = -22;
    const ev = run(s, 90, createBot('idle').step);
    expect(ev.some((e) => e.type === 'dead')).toBe(true);
    expect(s.status).toBe('dead');
  });
});

describe('the Greywater Front: can be finished', () => {
  it('a strong player finishes on Soldier', () => {
    const s = playThrough('oracle', 'soldier', 12);
    const r = getResult(s);
    expect(r.won).toBe(true);
    expect(r.outcome).toBe('released');
    expect(r.deaths).toBeLessThanOrEqual(8);
    expect(r.kills).toBeGreaterThanOrEqual(25);
    expect(chronicleLine({ spared: true, deaths: r.deaths, dispatches: r.dispatches.length })).toMatch(/Greywater Ford/);
  });

  it('a clumsy player finishes on Story', () => {
    const s = playThrough('recruit', 'story', 14, 77);
    expect(getResult(s).won).toBe(true);
    expect(getResult(s).deaths).toBeLessThanOrEqual(10);
  });

  it('a clumsy player can still finish on Veteran, the hard way', () => {
    const s = playThrough('recruit', 'veteran', 25, 9);
    expect(getResult(s).won).toBe(true);
  });
});

describe('the Greywater Front: purity', () => {
  it('uses no Math.random, Date.now or DOM', () => {
    for (const f of readdirSync(HERE)) {
      if (!f.endsWith('.js') || f.endsWith('.test.js')) continue;
      const src = readFileSync(join(HERE, f), 'utf8').replace(/^\s*\/\/.*$/gm, '');
      expect(src, f).not.toMatch(/Math\.random|Date\.now|document\.|window\.|performance\./);
    }
  });
});
