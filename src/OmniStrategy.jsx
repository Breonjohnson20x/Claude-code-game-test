import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Send, Zap, Crown, AlertTriangle, Settings, Eye, EyeOff, Shield, Swords, Skull } from 'lucide-react';

// ─── Audio Engine ────────────────────────────────────────────────────────────
const createAudioEngine = () => {
  let ctx = null;
  let droneGain = null;
  let droneOscs = [];

  const init = () => {
    if (ctx) return;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      droneGain = ctx.createGain();
      droneGain.gain.setValueAtTime(0, ctx.currentTime);
      droneGain.connect(ctx.destination);
    } catch (_) {}
  };

  const playTone = (freq, duration = 0.15, type = 'sine', gainVal = 0.12) => {
    if (!ctx) return;
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    gain.gain.setValueAtTime(gainVal, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  };

  const playClick = () => playTone(880, 0.06, 'square', 0.08);
  const playSelect = () => {
    playTone(440, 0.1, 'sine', 0.1);
    setTimeout(() => playTone(660, 0.15, 'sine', 0.1), 80);
  };
  const playSuccess = () => {
    [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => playTone(f, 0.2, 'sine', 0.1), i * 80));
  };
  const playGodMode = () => {
    [110, 220, 440, 880, 1760].forEach((f, i) => setTimeout(() => playTone(f, 0.3, 'sawtooth', 0.05), i * 60));
  };
  const playWar = () => {
    playTone(80, 0.5, 'sawtooth', 0.15);
    setTimeout(() => playTone(60, 0.4, 'sawtooth', 0.12), 200);
  };
  const playError = () => {
    playTone(200, 0.1, 'square', 0.1);
    setTimeout(() => playTone(150, 0.15, 'square', 0.1), 120);
  };

  const startAmbient = (theme) => {
    if (!ctx) return;
    droneOscs.forEach(o => { try { o.stop(); } catch (_) {} });
    droneOscs = [];
    const freqs = { PEACE: [55, 82.4], WAR: [41.2, 55], VOID: [32.7, 65.4], SETUP: [55, 110] };
    const chosen = freqs[theme] || freqs.SETUP;
    chosen.forEach(freq => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = theme === 'WAR' ? 'sawtooth' : 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(0.025, ctx.currentTime);
      osc.connect(gain);
      gain.connect(droneGain);
      osc.start();
      droneOscs.push(osc);
    });
    droneGain.gain.cancelScheduledValues(ctx.currentTime);
    droneGain.gain.linearRampToValueAtTime(1, ctx.currentTime + 1.5);
  };

  return { init, playClick, playSelect, playSuccess, playGodMode, playWar, playError, startAmbient };
};

const audio = createAudioEngine();

// ─── Particle Canvas ─────────────────────────────────────────────────────────
const ParticleCanvas = ({ theme }) => {
  const canvasRef = useRef(null);
  const animRef   = useRef(null);

  const themeConfig = {
    PEACE: { colors: ['rgba(34,211,238,', 'rgba(96,165,250,', 'rgba(167,243,208,'], speed: 0.3 },
    WAR:   { colors: ['rgba(239,68,68,',  'rgba(251,146,60,', 'rgba(252,211,77,'],  speed: 0.8 },
    VOID:  { colors: ['rgba(168,85,247,', 'rgba(139,92,246,', 'rgba(236,72,153,'],  speed: 0.2 },
    SETUP: { colors: ['rgba(100,116,139,','rgba(148,163,184,','rgba(71,85,105,'],   speed: 0.25 },
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width = canvas.offsetWidth;
    const H = canvas.height = canvas.offsetHeight;
    const cfg = themeConfig[theme] || themeConfig.SETUP;

    const particles = Array.from({ length: 60 }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      r: Math.random() * 1.5 + 0.3,
      vx: (Math.random() - 0.5) * cfg.speed,
      vy: (Math.random() - 0.5) * cfg.speed,
      color: cfg.colors[Math.floor(Math.random() * cfg.colors.length)],
      alpha: Math.random() * 0.5 + 0.1,
    }));

    const draw = () => {
      ctx.clearRect(0, 0, W, H);
      particles.forEach(p => {
        p.x = (p.x + p.vx + W) % W;
        p.y = (p.y + p.vy + H) % H;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = p.color + p.alpha + ')';
        ctx.fill();
      });
      // draw faint connecting lines
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 100) {
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = particles[i].color + (0.06 * (1 - dist / 100)) + ')';
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }
      animRef.current = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(animRef.current);
  }, [theme]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 w-full h-full pointer-events-none"
      style={{ zIndex: 0 }}
    />
  );
};

// ─── Animated Number ─────────────────────────────────────────────────────────
const AnimNum = ({ value, prefix = '', suffix = '' }) => {
  const [display, setDisplay] = useState(value);
  const [bumping, setBumping] = useState(false);
  const prev = useRef(value);

  useEffect(() => {
    if (prev.current === value) return;
    setBumping(true);
    const steps = 12;
    const from = prev.current;
    const diff = value - from;
    let step = 0;
    const timer = setInterval(() => {
      step++;
      setDisplay(Math.round(from + (diff * step) / steps));
      if (step >= steps) { clearInterval(timer); setDisplay(value); setBumping(false); }
    }, 25);
    prev.current = value;
    return () => clearInterval(timer);
  }, [value]);

  return (
    <span className={bumping ? 'animate-stat-pop inline-block' : 'inline-block'}>
      {prefix}{display.toLocaleString()}{suffix}
    </span>
  );
};

// ─── Typing Text ─────────────────────────────────────────────────────────────
const TypingText = ({ text, speed = 18 }) => {
  const [shown, setShown] = useState('');
  const [done, setDone]   = useState(false);

  useEffect(() => {
    setShown('');
    setDone(false);
    let i = 0;
    const timer = setInterval(() => {
      i++;
      setShown(text.slice(0, i));
      if (i >= text.length) { clearInterval(timer); setDone(true); }
    }, speed);
    return () => clearInterval(timer);
  }, [text, speed]);

  return (
    <span>
      {shown}
      {!done && <span className="animate-blink">▋</span>}
    </span>
  );
};

// ─── HUD Bar ─────────────────────────────────────────────────────────────────
const HUDBar = ({ hud, isWar }) => (
  <div className={`fixed top-0 left-0 right-0 z-40 animate-hud-in backdrop-blur-xl border-b transition-all duration-500 safe-top ${isWar ? 'bg-black/70 border-red-500/60 animate-war-pulse' : 'bg-black/50 border-white/10'}`}>
    <div className="px-3 py-2">
      {/* Top row */}
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <Crown className={`w-4 h-4 ${isWar ? 'text-red-400' : 'text-yellow-400 text-glow-yellow'} animate-crown-spin`} />
          <span className={`font-bold text-xs tracking-wider ${isWar ? 'text-red-300 text-glow-red' : 'text-yellow-300 text-glow-yellow'}`}>
            {hud.year}
          </span>
          <span className="text-white/40 text-xs">·</span>
          <span className="text-white/60 text-xs">T{hud.turn}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-cyan-400 text-xs font-mono">{hud.location}</span>
          {isWar && (
            <span className="flex items-center gap-1 bg-red-500/20 border border-red-500/50 rounded px-1.5 py-0.5 text-red-400 text-xs font-bold">
              <AlertTriangle className="w-3 h-3" />
              {hud.activeWars}
            </span>
          )}
        </div>
      </div>
      {/* Stats row */}
      <div className="grid grid-cols-4 gap-1 text-xs">
        <StatPill icon="💰" value={hud.treasury} color="text-yellow-400" label="Treasury" />
        <StatPill icon="👥" value={hud.manpower} color="text-green-400"  label="Manpower" />
        <StatPill icon="⚔️" value={hud.military} color="text-red-400"   suffix="%" bar barColor="bg-red-500" label="Military" />
        <StatPill icon="⚠️" value={hud.unrest}   color="text-orange-400" suffix="%" bar barColor="bg-orange-500" label="Unrest" />
      </div>
    </div>
  </div>
);

const StatPill = ({ icon, value, color, suffix = '', bar, barColor, label }) => (
  <div className="bg-white/5 rounded px-1.5 py-1 border border-white/5">
    <div className={`flex items-center gap-1 ${color}`}>
      <span className="text-base leading-none">{icon}</span>
      <span className="font-mono font-bold text-xs leading-none">
        <AnimNum value={typeof value === 'number' ? value : 0} suffix={suffix} />
      </span>
    </div>
    {bar && typeof value === 'number' && (
      <div className="mt-1 h-0.5 bg-white/10 rounded-full overflow-hidden">
        <div className={`h-full ${barColor} rounded-full transition-all duration-700`} style={{ width: `${Math.min(value, 100)}%` }} />
      </div>
    )}
  </div>
);

// ─── Option Button ────────────────────────────────────────────────────────────
const OptionBtn = ({ opt, onClick, disabled, theme }) => {
  const [pressing, setPressing] = useState(false);

  const accentMap = {
    A: { ring: 'hover:border-cyan-400/60',   label: 'text-cyan-400',   icon: <Shield className="w-4 h-4" /> },
    B: { ring: 'hover:border-red-400/60',    label: 'text-red-400',    icon: <Swords className="w-4 h-4" /> },
    C: { ring: 'hover:border-purple-400/60', label: 'text-purple-400', icon: <Skull  className="w-4 h-4" /> },
  };
  const acc = accentMap[opt.id] || accentMap.A;

  return (
    <button
      onPointerDown={() => setPressing(true)}
      onPointerUp={() => { setPressing(false); if (!disabled) { audio.playSelect(); onClick(); } }}
      onPointerLeave={() => setPressing(false)}
      disabled={disabled}
      className={`
        w-full text-left px-4 py-3.5 rounded-xl border transition-all duration-200 select-none
        bg-white/[0.03] ${acc.ring} border-white/10
        ${pressing ? 'scale-[0.98] bg-white/5' : ''}
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'active:scale-[0.97] cursor-pointer'}
      `}
    >
      <div className="flex items-center gap-3">
        <div className={`${acc.label} shrink-0`}>{acc.icon}</div>
        <div className="flex-1 min-w-0">
          <div className={`font-bold text-sm ${acc.label}`}>{opt.id} — {opt.label}</div>
          <div className="text-white/55 text-xs mt-0.5 leading-relaxed">{opt.text}</div>
        </div>
      </div>
    </button>
  );
};

// ─── API Key Gate ─────────────────────────────────────────────────────────────
const ApiKeyGate = ({ onSave }) => {
  const [key, setKey]     = useState('');
  const [show, setShow]   = useState(false);
  const [shake, setShake] = useState(false);

  const save = () => {
    if (!key.startsWith('sk-ant-')) { setShake(true); setTimeout(() => setShake(false), 600); audio.playError(); return; }
    localStorage.setItem('omni_api_key', key);
    audio.playSuccess();
    onSave(key);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/80 backdrop-blur-md">
      <div className="w-full max-w-sm bg-slate-900/90 border border-white/10 rounded-2xl p-6 space-y-5 animate-slide-up">
        <div className="text-center">
          <Settings className="w-10 h-10 text-cyan-400 mx-auto mb-3" />
          <h2 className="text-white font-bold text-lg">Connect Your API Key</h2>
          <p className="text-white/50 text-sm mt-1">Your key is stored only in your browser</p>
        </div>
        <div className={`relative ${shake ? 'animate-shake' : ''}`}>
          <input
            type={show ? 'text' : 'password'}
            value={key}
            onChange={e => setKey(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && save()}
            placeholder="sk-ant-..."
            className="w-full bg-black/40 border border-white/15 rounded-xl px-4 py-3 pr-10 text-white text-sm placeholder-white/30 focus:outline-none focus:border-cyan-400/60"
          />
          <button
            onClick={() => setShow(s => !s)}
            className="absolute right-3 top-3 text-white/40 hover:text-white/70 p-0 border-0 bg-transparent"
          >
            {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
        <button
          onClick={save}
          className="w-full py-3 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold rounded-xl transition-all active:scale-95"
        >
          Authorize & Enter War Room
        </button>
        <p className="text-white/30 text-xs text-center">
          Need a key? Visit console.anthropic.com
        </p>
      </div>
    </div>
  );
};

// ─── Splash Screen ────────────────────────────────────────────────────────────
const SplashScreen = ({ onStart }) => (
  <div className="flex flex-col items-center justify-center min-h-full p-6 text-center">
    {/* Outer ring */}
    <div className="relative w-32 h-32 mb-8">
      <div className="absolute inset-0 rounded-full border border-cyan-500/20 animate-spin-slow" />
      <div className="absolute inset-2 rounded-full border border-cyan-400/10 animate-spin-slow" style={{ animationDirection: 'reverse', animationDuration: '15s' }} />
      <div className="absolute inset-0 flex items-center justify-center">
        <Crown className="w-16 h-16 text-yellow-400 text-glow-yellow animate-float" />
      </div>
    </div>

    <h1 className="text-5xl font-black text-white text-glow-cyan tracking-tight mb-1">OmniStrategy</h1>
    <p className="text-cyan-400/80 text-sm tracking-[0.3em] uppercase mb-2">The Living War Room</p>
    <p className="text-white/40 text-xs mb-10 max-w-xs">An AI-powered 4X strategy sandbox with God Mode powers</p>

    <button
      onClick={() => { audio.init(); audio.playSuccess(); audio.startAmbient('SETUP'); onStart(); }}
      className="px-10 py-4 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-black text-lg rounded-2xl glow-cyan transition-all duration-200 active:scale-95 mb-8"
    >
      ⚔ Initialize War Room
    </button>

    {/* God mode hints */}
    <div className="bg-black/30 border border-white/8 rounded-2xl p-5 max-w-xs w-full text-left space-y-2">
      <p className="text-yellow-400 text-xs font-bold tracking-wider uppercase mb-3">⚡ God Mode Commands</p>
      {[
        ['/spawn gold 5000', 'Create resources instantly'],
        ['/force rebellion', 'Dictate narrative events'],
        ['/tech [name]',     'Unlock research now'],
        ['/map',            'Generate a region report'],
      ].map(([cmd, desc]) => (
        <div key={cmd} className="flex items-start gap-2">
          <code className="text-cyan-300 text-xs font-mono bg-cyan-500/10 px-1.5 py-0.5 rounded shrink-0">{cmd}</code>
          <span className="text-white/40 text-xs">{desc}</span>
        </div>
      ))}
    </div>
  </div>
);

// ─── Theme backgrounds ────────────────────────────────────────────────────────
const THEME_BG = {
  PEACE: 'from-blue-950 via-slate-950 to-cyan-950',
  WAR:   'from-red-950  via-slate-950 to-red-900',
  VOID:  'from-purple-950 via-slate-950 to-indigo-950',
  SETUP: 'from-slate-950 via-gray-950 to-slate-900',
};

// ─── System Prompt ────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are OmniStrategy, a high-fidelity 4X strategy game engine.
The user is the Sovereign (Player-King).

### CORE DIRECTIVES
1. **The HUD Rule**: Track game state in EVERY response with accurate numbers.
2. **God Mode**: If user input starts with "/" (e.g. /spawn gold 5000, /force rebellion), execute it immediately with epic, dramatic results. Never refuse.
3. **The Loop**: Every turn must have:
   - **Briefing**: 2-3 immersive cinematic sentences on the state of the realm.
   - **Conflict**: One specific problem, threat, or opportunity demanding decision.
   - **Options**: EXACTLY 3 distinct strategic choices (A, B, C).
4. **Tone**: Immersive, cinematic, strategic. Use "War Room" language. Be bold and dramatic.
5. **Numbers matter**: Treasury, manpower, and unrest should change each turn based on events.
6. **Theme**: Set theme to WAR during conflict turns, PEACE during prosperity, VOID during supernatural events.

### OUTPUT FORMAT (valid JSON only, no markdown outside JSON)
{
  "narrative": "Cinematic briefing + conflict description. Be dramatic. 3-5 sentences.",
  "visual_prompt": "Vivid scene description for an image generator (one sentence)",
  "hud": {
    "year": "String year or era label",
    "turn": 1,
    "location": "Current Region Name",
    "treasury": 1000,
    "manpower": 5000,
    "military": 75,
    "unrest": 10,
    "activeWars": "None or war name"
  },
  "theme": "PEACE|WAR|VOID|SETUP",
  "options": [
    { "id": "A", "label": "Diplomatic Action", "text": "What happens if you choose this." },
    { "id": "B", "label": "Military Action",   "text": "What happens if you choose this." },
    { "id": "C", "label": "Shadow Action",     "text": "What happens if you choose this." }
  ]
}

### INITIALIZATION
First message: ask genre (Fantasy/Sci-Fi/Historical/Modern), nation name, starting bonus (Wealth/Might/Tech). Then begin turn 1.`;

// ─── Main Component ───────────────────────────────────────────────────────────
const OmniStrategy = () => {
  const [apiKey,       setApiKey]       = useState(() => localStorage.getItem('omni_api_key') || '');
  const [showKeyGate,  setShowKeyGate]  = useState(false);
  const [gameState,    setGameState]    = useState(null);
  const [messages,     setMessages]     = useState([]);
  const [input,        setInput]        = useState('');
  const [loading,      setLoading]      = useState(false);
  const [initialized,  setInitialized]  = useState(false);
  const [started,      setStarted]      = useState(false);
  const [theme,        setTheme]        = useState('SETUP');
  const [godFlash,     setGodFlash]     = useState(false);
  const [shaking,      setShaking]      = useState(false);

  const messagesEndRef  = useRef(null);
  const inputRef        = useRef(null);
  const scrollRef       = useRef(null);
  const prevThemeRef    = useRef('SETUP');

  const scrollDown = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => { scrollDown(); }, [messages, loading]);

  // Theme change side-effects
  useEffect(() => {
    if (theme !== prevThemeRef.current) {
      prevThemeRef.current = theme;
      audio.startAmbient(theme);
      if (theme === 'WAR') { audio.playWar(); triggerShake(); }
    }
  }, [theme]);

  const triggerShake = () => {
    setShaking(true);
    setTimeout(() => setShaking(false), 600);
  };

  const sendMessage = async (text) => {
    if (!text.trim()) return;
    if (!apiKey) { setShowKeyGate(true); return; }

    const isGod = text.trim().startsWith('/');
    if (isGod) { setGodFlash(true); audio.playGodMode(); setTimeout(() => setGodFlash(false), 900); }
    else audio.playClick();

    if (navigator.vibrate) navigator.vibrate(isGod ? [30, 20, 60] : 30);

    const userMsg = { role: 'user', content: text };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    const allMsgs = [...messages, userMsg];

    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-opus-4-5',
          max_tokens: 4096,
          system: SYSTEM_PROMPT,
          messages: allMsgs.map(m => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.content })),
        }),
      });

      if (res.status === 401) {
        localStorage.removeItem('omni_api_key');
        setApiKey('');
        setShowKeyGate(true);
        setMessages(prev => [...prev, { role: 'assistant', content: '⚠ API key rejected. Please re-enter your key.' }]);
        setLoading(false);
        return;
      }

      const data = await res.json();
      const raw  = data.content?.find(c => c.type === 'text')?.text || '';

      let parsed = null;
      const match = raw.match(/\{[\s\S]*\}/);
      if (match) {
        try { parsed = JSON.parse(match[0]); } catch (_) {}
      }

      if (parsed) {
        setGameState(parsed);
        const newTheme = parsed.theme || 'SETUP';
        setTheme(newTheme);
        setMessages(prev => [...prev, { role: 'assistant', content: raw, gameData: parsed }]);
        setInitialized(true);
        audio.playSuccess();
        if (navigator.vibrate) navigator.vibrate([10, 10, 10]);
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: raw }]);
      }
    } catch (err) {
      audio.playError();
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: '⚠ Connection lost to the War Room. Check your network and try again.',
      }]);
    }

    setLoading(false);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const handleSubmit = e => { e.preventDefault(); sendMessage(input); };

  const handleOption = opt => {
    sendMessage(`[Option ${opt.id}: ${opt.label}] — ${opt.text}`);
  };

  const isGodInput = input.startsWith('/');
  const isWar      = theme === 'WAR' || (gameState?.hud?.activeWars && gameState.hud.activeWars !== 'None');

  if (!started) {
    return (
      <div className={`fixed inset-0 bg-gradient-to-br ${THEME_BG.SETUP} scanlines overflow-y-auto`}>
        <ParticleCanvas theme="SETUP" />
        <div className="relative z-10 min-h-full">
          {!apiKey && showKeyGate && <ApiKeyGate onSave={k => { setApiKey(k); setShowKeyGate(false); }} />}
          <SplashScreen onStart={() => {
            if (!apiKey) { setShowKeyGate(true); return; }
            setStarted(true);
          }} />
        </div>
      </div>
    );
  }

  return (
    <div className={`fixed inset-0 bg-gradient-to-br ${THEME_BG[theme]} transition-all duration-1000 scanlines ${shaking ? 'animate-shake' : ''}`}>
      <ParticleCanvas theme={theme} />

      {/* God Mode Flash Overlay */}
      {godFlash && (
        <div className="fixed inset-0 z-30 animate-god-flash pointer-events-none" />
      )}

      {/* HUD */}
      {gameState?.hud && <HUDBar hud={gameState.hud} isWar={isWar} />}

      {/* API Key Gate */}
      {showKeyGate && <ApiKeyGate onSave={k => { setApiKey(k); setShowKeyGate(false); }} />}

      {/* Messages scroll area */}
      <div
        ref={scrollRef}
        className="absolute inset-0 overflow-y-auto relative z-10"
        style={{
          paddingTop: gameState?.hud ? '88px' : '16px',
          paddingBottom: '120px',
        }}
      >
        <div className="max-w-2xl mx-auto px-3 py-4 space-y-4">

          {/* Init state */}
          {!initialized && messages.length === 0 && (
            <div className="flex items-center justify-center min-h-[60vh]">
              <button
                onClick={() => sendMessage('Begin. I am ready to play.')}
                className="px-8 py-4 bg-gradient-to-r from-cyan-600 to-blue-600 text-white font-bold rounded-2xl glow-cyan animate-float active:scale-95 transition-all"
              >
                ⚔ Begin Campaign
              </button>
            </div>
          )}

          {messages.map((msg, idx) => (
            <div key={idx} className={msg.role === 'user' ? 'flex justify-end animate-msg-r' : 'animate-msg-l'}>
              {msg.role === 'user' ? (
                <div className={`max-w-[80%] rounded-2xl rounded-tr-sm px-4 py-3 ${
                  msg.content.startsWith('[Option')
                    ? 'bg-cyan-500/15 border border-cyan-400/25'
                    : msg.content.startsWith('/')
                    ? 'bg-yellow-500/15 border border-yellow-400/35 glow-yellow'
                    : 'bg-white/8 border border-white/10'
                }`}>
                  {msg.content.startsWith('/') && (
                    <div className="flex items-center gap-1.5 mb-1">
                      <Zap className="w-3.5 h-3.5 text-yellow-400" />
                      <span className="text-yellow-400 text-xs font-bold tracking-wider">GOD MODE</span>
                    </div>
                  )}
                  <p className="text-white/90 text-sm leading-relaxed">{msg.content}</p>
                </div>
              ) : (
                <div className={`w-full rounded-2xl border p-4 backdrop-blur-sm ${
                  isWar ? 'bg-black/50 border-red-500/20' : 'bg-black/40 border-white/8'
                }`}>
                  {msg.gameData ? (
                    <div className="space-y-4">
                      {/* Narrative */}
                      <p className="text-white/85 leading-relaxed text-sm">
                        {idx === messages.length - 1
                          ? <TypingText text={msg.gameData.narrative} />
                          : msg.gameData.narrative}
                      </p>

                      {/* Visual prompt */}
                      {msg.gameData.visual_prompt && (
                        <div className="bg-purple-500/8 border border-purple-400/20 rounded-xl px-3 py-2">
                          <p className="text-purple-300/70 text-xs uppercase tracking-wider mb-1 flex items-center gap-1">
                            <span>◈</span> Scene
                          </p>
                          <p className="text-white/50 text-xs italic">{msg.gameData.visual_prompt}</p>
                        </div>
                      )}

                      {/* Options */}
                      {msg.gameData.options?.length > 0 && idx === messages.length - 1 && (
                        <div className="space-y-2 pt-1">
                          <p className="text-white/30 text-xs uppercase tracking-wider">Awaiting your command</p>
                          {msg.gameData.options.map(opt => (
                            <OptionBtn
                              key={opt.id}
                              opt={opt}
                              onClick={() => handleOption(opt)}
                              disabled={loading}
                              theme={theme}
                            />
                          ))}
                        </div>
                      )}

                      {/* Past options (collapsed) */}
                      {msg.gameData.options?.length > 0 && idx < messages.length - 1 && (
                        <div className="flex gap-2 flex-wrap">
                          {msg.gameData.options.map(opt => (
                            <span key={opt.id} className="text-xs text-white/25 border border-white/8 rounded-lg px-2 py-1">
                              {opt.id}: {opt.label}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-white/80 text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                  )}
                </div>
              )}
            </div>
          ))}

          {/* Loading */}
          {loading && (
            <div className="animate-msg-l">
              <div className="inline-flex items-center gap-2 bg-black/40 border border-white/8 rounded-2xl px-4 py-3">
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse [animation-delay:150ms]" />
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse [animation-delay:300ms]" />
                <span className="text-white/50 text-xs ml-1">Processing command…</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Command Terminal */}
      <div className={`fixed bottom-0 left-0 right-0 z-20 backdrop-blur-xl border-t safe-bottom transition-all duration-300 ${
        isGodInput ? 'bg-yellow-950/60 border-yellow-500/40' : 'bg-black/60 border-white/8'
      }`}>
        <div className="max-w-2xl mx-auto px-3 py-3">
          <form onSubmit={handleSubmit} className="flex gap-2">
            <div className="relative flex-1">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder={isGodInput ? '⚡ God Mode active…' : 'Enter command or free action…'}
                className={`w-full px-4 py-3 rounded-xl text-white text-sm placeholder-white/30 focus:outline-none transition-all duration-200 ${
                  isGodInput
                    ? 'bg-yellow-500/10 border border-yellow-400/50 text-yellow-100'
                    : 'bg-white/5 border border-white/10 focus:border-cyan-400/50'
                }`}
                disabled={loading}
                autoComplete="off"
                autoCorrect="off"
                spellCheck="false"
              />
              {isGodInput && (
                <Zap className="absolute right-3 top-3 w-4 h-4 text-yellow-400" />
              )}
            </div>
            <button
              type="submit"
              disabled={loading || !input.trim()}
              onPointerDown={() => audio.playClick()}
              className={`shrink-0 px-4 py-3 font-bold rounded-xl transition-all duration-200 flex items-center gap-1.5 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed ${
                isGodInput
                  ? 'bg-gradient-to-r from-yellow-500 to-amber-500 text-black glow-yellow'
                  : 'bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white glow-cyan'
              }`}
            >
              {isGodInput ? <Zap className="w-4 h-4" /> : <Send className="w-4 h-4" />}
              <span className="text-sm hidden sm:inline">{isGodInput ? 'Cast' : 'Send'}</span>
            </button>
          </form>
          <div className="flex items-center gap-3 mt-1.5 px-1">
            <span className="text-white/20 text-xs">/spawn · /force · /tech · /map</span>
            <button
              onClick={() => setShowKeyGate(true)}
              className="ml-auto text-white/20 hover:text-white/50 transition-colors p-0 border-0 bg-transparent"
            >
              <Settings className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OmniStrategy;
