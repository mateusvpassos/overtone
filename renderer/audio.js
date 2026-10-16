// Motor de som: síntese em WebAudio, sem samples.
// Engine.noteOn(nota, vel, presetId) devolve um handle; Engine.noteOff(handle) solta.
const PRESETS = [
  // ---- teclas ----
  {
    id: 'grand', cat: 'Teclas', name: 'Piano de cauda', desc: 'Steinway gravado, 2 camadas de força', icon: 'piano', c: '#e7e5e4',
    sampler: 'piano', osc: [], filter: { f: 16000, q: .3 }, env: { a: .001, d: 1, s: 1, r: .45 }, vib: 0
  },
  {
    id: 'piano', cat: 'Teclas', name: 'Piano elétrico', desc: 'Timbre de Rhodes, decai sozinho', icon: 'piano', c: '#ffbf47',
    osc: [{ type: 'sine', gain: .7 }, { type: 'triangle', gain: .18, ratio: 2 }],
    fm: { ratio: 1, index: 1.8, decay: .8 },
    filter: { f: 5200, q: .4 }, env: { a: .003, d: 1.8, s: 0, r: .4 }, vib: 0
  },
  {
    id: 'organ', cat: 'Teclas', name: 'Órgão', desc: 'Drawbars, sustenta enquanto segura', icon: 'drawbars', c: '#3ddc97',
    osc: [{ type: 'sine', gain: .32, ratio: .5 }, { type: 'sine', gain: .32 }, { type: 'sine', gain: .2, ratio: 1.5 }, { type: 'sine', gain: .2, ratio: 2 }, { type: 'sine', gain: .1, ratio: 4 }],
    filter: { f: 7000, q: .3 }, env: { a: .008, d: .1, s: 1, r: .07 }, vib: 7
  },
  {
    id: 'clav', cat: 'Teclas', name: 'Clavinet', desc: 'Funk, ataque estalado', icon: 'piano', c: '#facc15',
    osc: [{ type: 'square', gain: .3 }, { type: 'sawtooth', gain: .15, ratio: 2 }],
    filter: { f: 1600, q: 5, env: 3200, envD: .08 }, env: { a: .001, d: .4, s: .3, r: .05 }, vib: 0
  },
  // ---- gravados ----
  {
    id: 'guitar', cat: 'Gravados', name: 'Violão nylon', desc: 'Violão clássico gravado (FreePats)', icon: 'music', c: '#d6a36b',
    sampler: 'guitar', gain: 1.5, osc: [], filter: { f: 15000, q: .3 }, env: { a: .001, d: 1, s: 1, r: .5 }, vib: 0
  },
  {
    id: 'ebass', cat: 'Gravados', name: 'Baixo elétrico', desc: 'Baixo de dedo gravado, uma oitava abaixo', icon: 'waves', c: '#f87171',
    sampler: 'bass', shift: -12, gain: 1.6, osc: [], filter: { f: 9000, q: .3 }, env: { a: .001, d: 1, s: 1, r: .2 }, vib: 0
  },
  {
    id: 'vibes', cat: 'Gravados', name: 'Vibrafone', desc: 'Lâminas de metal com baqueta', icon: 'bars', c: '#7dd3fc',
    sampler: 'vibes', gain: 1.4, osc: [], filter: { f: 15000, q: .3 }, env: { a: .001, d: 1, s: 1, r: 1.2 }, vib: 0
  },
  {
    id: 'charp', cat: 'Gravados', name: 'Harpa de concerto', desc: 'Harpa gravada, cauda longa', icon: 'harp', c: '#f0abfc',
    sampler: 'harp', gain: 1.4, osc: [], filter: { f: 15000, q: .3 }, env: { a: .001, d: 1, s: 1, r: 1.6 }, vib: 0
  },
  {
    id: 'sax', cat: 'Gravados', name: 'Sax tenor', desc: 'Sax gravado, sustenta ~4s', icon: 'megaphone', c: '#fcd34d',
    sampler: 'sax', gain: 1.4, osc: [], filter: { f: 12000, q: .3 }, env: { a: .015, d: 1, s: 1, r: .18 }, vib: 0
  },
  // ---- synth ----
  {
    id: 'lead', cat: 'Synth', name: 'Synth lead', desc: 'Duas serras desafinadas + sub', icon: 'zap', c: '#22c3e6',
    osc: [{ type: 'sawtooth', gain: .32, detune: -9 }, { type: 'sawtooth', gain: .32, detune: 9 }, { type: 'square', gain: .2, ratio: .5 }],
    filter: { f: 2200, q: 3, env: 2600, envD: .35 }, env: { a: .005, d: .25, s: .75, r: .2 }, vib: 4
  },
  {
    id: 'supersaw', cat: 'Synth', name: 'Supersaw', desc: 'Cinco serras, acorde de trance', icon: 'layers', c: '#38bdf8',
    osc: [-24, -12, 0, 12, 24].map(d => ({ type: 'sawtooth', gain: .15, detune: d })),
    filter: { f: 3800, q: 1 }, env: { a: .01, d: .3, s: .85, r: .4 }, vib: 0
  },
  {
    id: 'pad', cat: 'Synth', name: 'Pad', desc: 'Entrada lenta, cheio e largo', icon: 'cloud', c: '#6f8bff',
    osc: [{ type: 'sawtooth', gain: .22, detune: -14 }, { type: 'sawtooth', gain: .22 }, { type: 'sawtooth', gain: .22, detune: 14 }, { type: 'sine', gain: .2, ratio: .5 }],
    filter: { f: 1100, q: 1, env: 900, envA: 1.4, envD: 2 }, env: { a: .7, d: 1.2, s: .8, r: 1.8 }, vib: 3
  },
  {
    id: 'pluck', cat: 'Synth', name: 'Pluck', desc: 'Beliscado curto, bom pra arpejo', icon: 'droplet', c: '#ff9f6e',
    osc: [{ type: 'sawtooth', gain: .35 }, { type: 'square', gain: .2, detune: 6 }],
    filter: { f: 380, q: 4, env: 4200, envD: .16 }, env: { a: .002, d: .5, s: 0, r: .25 }, vib: 0
  },
  {
    id: 'chip', cat: 'Synth', name: '8-bit', desc: 'Quadrada de videogame', icon: 'gamepad', c: '#f472b6',
    osc: [{ type: 'square', gain: .3 }],
    filter: { f: 9000, q: .2 }, env: { a: .001, d: .12, s: .6, r: .05 }, vib: 0
  },
  // ---- baixo ----
  {
    id: 'bass', cat: 'Baixo', name: 'Baixo', desc: 'Grave com ataque de filtro', icon: 'waves', c: '#ff5d6c',
    osc: [{ type: 'square', gain: .3, ratio: .5 }, { type: 'sawtooth', gain: .3, ratio: .5 }, { type: 'sine', gain: .45, ratio: .25 }],
    filter: { f: 420, q: 6, env: 1700, envD: .2 }, env: { a: .003, d: .4, s: .55, r: .09 }, vib: 0
  },
  {
    id: 'acid', cat: 'Baixo', name: 'Acid', desc: 'Estilo 303, gire Filtro e Ressonância', icon: 'activity', c: '#a3e635',
    osc: [{ type: 'sawtooth', gain: .45, ratio: .5 }],
    filter: { f: 260, q: 13, env: 3200, envD: .14 }, env: { a: .002, d: .25, s: .7, r: .06 }, vib: 0
  },
  {
    id: 'sub', cat: 'Baixo', name: 'Sub 808', desc: 'Grave longo de trap', icon: 'speaker', c: '#fb7185',
    osc: [{ type: 'sine', gain: .85, ratio: .5 }, { type: 'triangle', gain: .12, ratio: .5 }],
    filter: { f: 900, q: .3 }, env: { a: .003, d: 2.4, s: 0, r: .3 }, vib: 0
  },
  // ---- orquestra ----
  {
    id: 'strings', cat: 'Orquestra', name: 'Cordas', desc: 'Ensemble suave com vibrato', icon: 'music', c: '#c084fc',
    osc: [{ type: 'sawtooth', gain: .26, detune: -7 }, { type: 'sawtooth', gain: .26, detune: 7 }, { type: 'triangle', gain: .2, ratio: 2 }],
    filter: { f: 2600, q: .7 }, env: { a: .32, d: .5, s: .85, r: .9 }, vib: 9
  },
  {
    id: 'brass', cat: 'Orquestra', name: 'Metais', desc: 'Naipe de sopro com "bwah"', icon: 'megaphone', c: '#fbbf24',
    osc: [{ type: 'sawtooth', gain: .3, detune: -5 }, { type: 'sawtooth', gain: .3, detune: 5 }],
    filter: { f: 800, q: 1.5, env: 2400, envA: .08, envD: .4 }, env: { a: .05, d: .3, s: .8, r: .2 }, vib: 5
  },
  {
    id: 'flute', cat: 'Orquestra', name: 'Flauta', desc: 'Suave, vibrato expressivo', icon: 'wind', c: '#67e8f9',
    osc: [{ type: 'sine', gain: .55 }, { type: 'triangle', gain: .08, ratio: 2 }],
    filter: { f: 3000, q: .3 }, env: { a: .07, d: .2, s: .9, r: .15 }, vib: 12
  },
  {
    id: 'harp', cat: 'Orquestra', name: 'Harpa', desc: 'Corda dedilhada, cauda longa', icon: 'harp', c: '#e879f9',
    osc: [{ type: 'triangle', gain: .5 }, { type: 'sine', gain: .15, ratio: 2 }],
    filter: { f: 2500, q: .5, env: 2000, envD: .2 }, env: { a: .002, d: 2.2, s: 0, r: 1 }, vib: 0
  },
  // ---- percussivo ----
  {
    id: 'bell', cat: 'Percussivo', name: 'Sino', desc: 'FM metálico, cauda longa', icon: 'bell', c: '#5ef0b0',
    osc: [{ type: 'sine', gain: .6 }, { type: 'sine', gain: .15, ratio: 4.2 }],
    fm: { ratio: 3.5, index: 4, decay: 1.6 },
    filter: { f: 9000, q: .2 }, env: { a: .002, d: 3, s: 0, r: 1.4 }, vib: 0
  },
  {
    id: 'marimba', cat: 'Percussivo', name: 'Marimba', desc: 'Madeira, curta e redonda', icon: 'bars', c: '#f59e0b',
    osc: [{ type: 'sine', gain: .7 }],
    fm: { ratio: 4, index: .9, decay: .08 },
    filter: { f: 6000, q: .2 }, env: { a: .002, d: .7, s: 0, r: .3 }, vib: 0
  },
  {
    id: 'kalimba', cat: 'Percussivo', name: 'Kalimba', desc: 'Lâmina de metal, brilho rápido', icon: 'sparkle', c: '#2dd4bf',
    osc: [{ type: 'sine', gain: .6 }],
    fm: { ratio: 7, index: 1.2, decay: .05 },
    filter: { f: 8000, q: .2 }, env: { a: .001, d: 1.4, s: 0, r: .5 }, vib: 0
  }
];

const KITS = [
  { id: 'acustico', name: 'Acústico' },
  { id: 'eletronico', name: 'Eletrônico' },
  { id: '808', name: '808' },
  { id: 'lofi', name: 'Lo-fi' }
];

// biblioteca de bateria/percussão; os pads usam 8 delas (dá pra trocar)
const DRUM_LIB = [
  { id: 'kick', name: 'Bumbo', c: '#ff5d6c' },
  { id: 'snare', name: 'Caixa', c: '#ffbf47' },
  { id: 'hat', name: 'Chimbal', c: '#5ef0b0' },
  { id: 'openhat', name: 'Chimbal aberto', c: '#3ddc97' },
  { id: 'clap', name: 'Palmas', c: '#f472b6' },
  { id: 'tom', name: 'Tom', c: '#ff9f6e' },
  { id: 'cowbell', name: 'Cowbell', c: '#c084fc' },
  { id: 'crash', name: 'Prato', c: '#22c3e6' },
  { id: 'tom2', name: 'Tom grave', c: '#fb923c', g: 'Bateria' },
  { id: 'rim', name: 'Aro (cross-stick)', c: '#facc15', g: 'Bateria' },
  { id: 'ghost', name: 'Caixa fraca', c: '#fde68a', g: 'Bateria' },
  { id: 'pedalhat', name: 'Chimbal no pé', c: '#86efac', g: 'Bateria' },
  { id: 'ride', name: 'Condução (ride)', c: '#38bdf8', g: 'Pratos' },
  { id: 'ridebell', name: 'Cúpula do ride', c: '#67e8f9', g: 'Pratos' },
  { id: 'shaker', name: 'Shaker', c: '#a3e635', g: 'Percussão' },
  { id: 'tamb', name: 'Pandeirola', c: '#fbbf24', g: 'Percussão' },
  { id: 'conga', name: 'Conga', c: '#f97316', g: 'Percussão' },
  { id: 'bongo', name: 'Bongô', c: '#fb7185', g: 'Percussão' },
  { id: 'cajon', name: 'Cajón grave', c: '#d97706', g: 'Percussão' },
  { id: 'cajonslap', name: 'Cajón agudo', c: '#f59e0b', g: 'Percussão' },
  { id: 'claves', name: 'Claves', c: '#e879f9', g: 'Percussão' },
  { id: 'woodblock', name: 'Bloco de madeira', c: '#c084fc', g: 'Percussão' },
  { id: 'triangle', name: 'Triângulo', c: '#5eead4', g: 'Percussão' }
];
const DRUMS = DRUM_LIB.slice(0, 8);
for (const d of DRUMS) d.g = d.id === 'crash' ? 'Pratos' : d.id === 'cowbell' || d.id === 'clap' ? 'Percussão' : 'Bateria';
// kits sintéticos não têm todas: usa a mais parecida
const DRUM_FALLBACK = { tom2: 'tom', rim: 'cowbell', ghost: 'snare', pedalhat: 'hat', ride: 'openhat', ridebell: 'cowbell', shaker: 'hat', tamb: 'openhat', conga: 'tom', bongo: 'tom', cajon: 'kick', cajonslap: 'snare', claves: 'cowbell', woodblock: 'cowbell', triangle: 'cowbell' };

const Engine = (() => {
  const ctx = new AudioContext({ latencyHint: 'interactive' });
  const p = { volume: .8, cutoff: .5, reso: .15, attack: .5, release: .5, reverb: .25, delay: 0, drums: .8 };
  let bend = 0, wheel = 0, bpm = 100;

  // ---------- cadeia mestre ----------
  const master = ctx.createGain();
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14; comp.ratio.value = 4; comp.attack.value = .004; comp.release.value = .2;
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 2048;
  master.connect(comp).connect(analyser).connect(ctx.destination);

  const synthBus = ctx.createGain();
  const drumBus = ctx.createGain();
  synthBus.connect(master);
  drumBus.connect(master);

  const reverb = ctx.createConvolver();
  reverb.buffer = impulse(2.8, 2.4);
  const revSend = ctx.createGain();
  const drumRev = ctx.createGain();
  synthBus.connect(revSend).connect(reverb).connect(master);
  drumBus.connect(drumRev).connect(reverb);

  const delay = ctx.createDelay(2);
  const fb = ctx.createGain();
  const delTone = ctx.createBiquadFilter();
  delTone.type = 'lowpass'; delTone.frequency.value = 3200;
  const delSend = ctx.createGain();
  synthBus.connect(delSend).connect(delay).connect(delTone).connect(fb).connect(delay);
  delTone.connect(master);

  // vibrato global: um LFO ligado ao detune de todas as vozes
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 5.4;
  const lfoDepth = ctx.createGain();
  lfo.connect(lfoDepth);
  lfo.start();

  const noise = (() => {
    const b = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return b;
  })();

  function impulse(sec, decay) {
    const len = ctx.sampleRate * sec;
    const b = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = b.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** decay;
    }
    return b;
  }

  // ---------- parâmetros (knobs, 0..1) ----------
  const cutMul = () => 2 ** ((p.cutoff - .5) * 5);       // 0.18x .. 5.6x
  const atkMul = () => 2 ** ((p.attack - .5) * 7);
  const relMul = () => 2 ** ((p.release - .5) * 6);
  const clampF = f => Math.max(30, Math.min(18000, f));

  const buses = new Set();
  function apply() {
    for (const b of buses) b.sends();
    const t = ctx.currentTime;
    master.gain.setTargetAtTime(p.volume ** 1.6, t, .02);
    revSend.gain.setTargetAtTime(p.reverb * .9, t, .03);
    drumRev.gain.setTargetAtTime(p.reverb * .35, t, .03);
    delSend.gain.setTargetAtTime(p.delay * .7, t, .03);
    fb.gain.setTargetAtTime(Math.min(.75, p.delay * .8), t, .03);
    delay.delayTime.setTargetAtTime(60 / bpm * .75, t, .05);
    drumBus.gain.setTargetAtTime(p.drums * 1.1, t, .02);
    for (const v of voices) {
      v.filt.frequency.setTargetAtTime(clampF(v.P.filter.f * cutMul()), t, .03);
      v.filt.Q.setTargetAtTime(v.P.filter.q + p.reso * 16, t, .03);
    }
  }

  // ---------- vozes ----------
  const voices = new Set();
  let currentPreset = PRESETS[0];

  function noteOn(note, vel = 100, presetId, bus) {
    if (ctx.state !== 'running') ctx.resume();
    let P = PRESETS.find(x => x.id === presetId) || currentPreset;
    // piano gravado ainda carregando: usa o elétrico
    if (P.sampler && !SAMPLES.inst[P.sampler]?.length) P = PRESETS.find(x => x.id === (P.sampler === 'bass' ? 'bass' : 'piano'));
    if (voices.size >= 32) kill([...voices][0]);
    const t = ctx.currentTime;
    const freq = 440 * 2 ** ((note - 69) / 12);
    const v = (vel / 127) ** 1.4;

    const filt = ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.Q.value = P.filter.q + p.reso * 16;
    const base = clampF(P.filter.f * cutMul());
    filt.frequency.setValueAtTime(base, t);
    if (P.filter.env) {
      const a = P.filter.envA || .004;
      filt.frequency.linearRampToValueAtTime(clampF(base + P.filter.env * cutMul() * (.4 + .6 * v)), t + a);
      filt.frequency.setTargetAtTime(base, t + a, (P.filter.envD || .3) / 3);
    }

    const amp = ctx.createGain();
    amp.gain.value = 0;
    filt.connect(amp).connect(bus ? bus.synth : synthBus);

    let mod = null;
    if (P.fm) {
      mod = { osc: ctx.createOscillator(), g: ctx.createGain() };
      mod.osc.frequency.value = freq * P.fm.ratio;
      mod.g.gain.setValueAtTime(freq * P.fm.index * (.5 + v), t);
      mod.g.gain.setTargetAtTime(freq * P.fm.index * .08, t, P.fm.decay / 3);
      mod.osc.connect(mod.g);
      mod.osc.start(t);
    }

    const oscs = P.sampler ? [sampleOsc(P, note, vel, t, filt)] : P.osc.map(o => {
      const osc = ctx.createOscillator();
      osc.type = o.type;
      osc.frequency.value = freq * (o.ratio || 1);
      osc.detune.value = (o.detune || 0) + bend;
      const g = ctx.createGain();
      g.gain.value = o.gain;
      osc.connect(g).connect(filt);
      lfoDepth.connect(osc.detune);
      if (mod) mod.g.connect(osc.frequency);
      osc.start(t);
      return { osc, base: o.detune || 0 };
    });

    const A = Math.max(.002, P.env.a * atkMul());
    const peak = .3 * v;
    amp.gain.setValueAtTime(0, t);
    amp.gain.linearRampToValueAtTime(peak, t + A);
    amp.gain.setTargetAtTime(peak * P.env.s, t + A, P.env.d / 3);

    const voice = { note, P, filt, amp, oscs, mod, done: false };
    voices.add(voice);
    if (!P.env.s) stopAt(voice, t + A + P.env.d * 2.2);
    lfoDepth.gain.setTargetAtTime(P.vib + wheel * 45, t, .05);
    currentVib = P.vib;
    return voice;
  }
  let currentVib = 0;

  // ---------- samples (piano e bateria acústica, VCSL CC0) ----------
  const SAMPLES = { inst: {}, drums: {}, rr: {} };
  async function loadSamples(read) {
    const toBuf = async f => {
      const u8 = await read(f);
      return ctx.decodeAudioData(u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength));
    };
    const man = JSON.parse(new TextDecoder().decode(await read('samples.json')));
    const drums = {};
    await Promise.all(Object.entries(man.drums).map(async ([id, files]) => { drums[id] = await Promise.all(files.map(toBuf)); }));
    SAMPLES.drums = drums;
    const inst = man.instruments || { piano: man.piano };
    // piano primeiro (é o mais usado), depois o resto
    for (const name of ['piano', ...Object.keys(inst).filter(k => k !== 'piano')]) {
      SAMPLES.inst[name] = await Promise.all(inst[name].map(async z => ({ ...z, buf: await toBuf(z.file) })));
    }
  }
  // camada suave abaixo de vel 84; zona mais próxima da nota
  function sampleOsc(P, note, vel, t, dest) {
    const zones = SAMPLES.inst[P.sampler];
    note += P.shift || 0;
    const layer = zones.some(z => z.layer === 'soft') && vel < 84 ? 'soft' : 'hard';
    let best = null;
    for (const z of zones) if (z.layer === layer && (!best || Math.abs(z.note - note) < Math.abs(best.note - note))) best = z;
    const src = ctx.createBufferSource();
    src.buffer = best.buf;
    src.playbackRate.value = 2 ** ((note - best.note) / 12);
    src.detune.value = bend;
    const g = ctx.createGain();
    g.gain.value = P.gain ? (layer === 'soft' ? P.gain * .8 : P.gain) : layer === 'soft' ? 2.2 : 2.8;
    src.connect(g).connect(dest);
    lfoDepth.connect(src.detune);
    src.start(t);
    return { osc: src, base: 0 };
  }
  function sampleDrum(id, vel, t, out) {
    const list = SAMPLES.drums[id];
    if (!list?.length) return false;
    let buf;
    if (id === 'kick' || id === 'snare') buf = list[Math.min(list.length - 1, Math.floor(vel / 128 * list.length))];
    else buf = list[(SAMPLES.rr[id] = ((SAMPLES.rr[id] || 0) + 1) % list.length)];
    const s = ctx.createBufferSource();
    s.buffer = buf;
    s.playbackRate.value = 1 + (Math.random() - .5) * .015; // leve variação, soa menos repetido
    const g = ctx.createGain();
    g.gain.value = .85;
    s.connect(g).connect(out);
    s.start(t);
    return true;
  }

  function noteOff(voice) {
    if (!voice || voice.done || voice.released) return;
    voice.released = true;
    const t = ctx.currentTime;
    const R = Math.max(.02, voice.P.env.r * relMul());
    voice.amp.gain.cancelAndHoldAtTime(t);
    voice.amp.gain.setTargetAtTime(0, t, R / 4);
    stopAt(voice, t + R * 1.6 + .05);
  }

  function stopAt(voice, when) {
    for (const o of voice.oscs) { try { o.osc.stop(when); } catch {} }
    if (voice.mod) { try { voice.mod.osc.stop(when); } catch {} }
    voice.oscs[0].osc.onended = () => kill(voice);
  }

  function kill(voice) {
    if (voice.done) return;
    voice.done = true;
    voices.delete(voice);
    for (const o of voice.oscs) { try { o.osc.stop(); } catch {} o.osc.disconnect(); }
    if (voice.mod) { try { voice.mod.osc.stop(); } catch {} voice.mod.osc.disconnect(); }
    voice.amp.disconnect();
  }

  function panic() {
    for (const v of [...voices]) kill(v);
    fb.gain.cancelScheduledValues(ctx.currentTime);
    fb.gain.setValueAtTime(0, ctx.currentTime);
    setTimeout(apply, 300);
  }

  function setBend(cents) {
    bend = cents;
    const t = ctx.currentTime;
    for (const v of voices) for (const o of v.oscs) o.osc.detune.setTargetAtTime(o.base + bend, t, .01);
  }

  function setWheel(x) {
    wheel = x;
    lfoDepth.gain.setTargetAtTime(currentVib + wheel * 45, ctx.currentTime, .03);
  }

  // ---------- bateria ----------
  function noiseSrc(t, dur) {
    const s = ctx.createBufferSource();
    s.buffer = noise;
    s.start(t, Math.random() * 1.5);
    s.stop(t + dur);
    return s;
  }
  function envGain(t, level, dur, out) {
    const g = ctx.createGain();
    g.gain.setValueAtTime(level, t);
    g.gain.exponentialRampToValueAtTime(.0008, t + dur);
    g.connect(out);
    return g;
  }
  function filter(type, f, q = .7) {
    const b = ctx.createBiquadFilter();
    b.type = type; b.frequency.value = f; b.Q.value = q;
    return b;
  }
  function tone(t, type, f0, f1, sweep, dur, level, out) {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + sweep);
    o.connect(envGain(t, level, dur, out));
    o.start(t);
    o.stop(t + dur + .02);
  }

  // chimbal/prato do 808: seis quadradas desafinadas filtradas
  function metal(t, dur, level, out, hp = 7000) {
    const bp = filter('bandpass', 10000, .8);
    bp.connect(filter('highpass', hp)).connect(envGain(t, level, dur, out));
    for (const r of [2, 3, 4.16, 5.43, 6.79, 8.21]) {
      const o = ctx.createOscillator();
      o.type = 'square'; o.frequency.value = 40 * r;
      o.connect(bp); o.start(t); o.stop(t + dur + .02);
    }
  }

  // lo-fi: satura e abafa
  const lofiIn = ctx.createGain();
  const crush = ctx.createWaveShaper();
  crush.curve = Float32Array.from({ length: 256 }, (_, i) => Math.round(Math.tanh((i / 128 - 1) * 2.2) * 12) / 12);
  lofiIn.connect(crush).connect(filter('lowpass', 2600, .5)).connect(drumBus);

  let currentKit = 'acustico';

  function drum(id, vel = 110, when = 0, kit = currentKit, bus) {
    if (ctx.state !== 'running') ctx.resume();
    const t = Math.max(ctx.currentTime, when);
    const out = ctx.createGain();
    out.gain.value = (vel / 127) ** 1.2;
    out.connect(kit === 'lofi' && id !== 'click' ? (bus ? bus.lofi : lofiIn) : bus ? bus.drum : drumBus);
    if ((kit === 'acustico' || kit === 'lofi') && id !== 'click' && sampleDrum(id, vel, t, out)) {
      setTimeout(() => out.disconnect(), (t - ctx.currentTime + 3.5) * 1000);
      return;
    }
    if (!['kick', 'snare', 'hat', 'openhat', 'clap', 'tom', 'cowbell', 'crash', 'click'].includes(id)) {
      if (id === 'ghost') out.gain.value *= .45;
      id = DRUM_FALLBACK[id] || 'hat';
    }
    if (kit === '808') {
      const done = {
        kick: () => tone(t, 'sine', 125, 48, .07, 1.1, 1.1, out),
        snare: () => {
          tone(t, 'triangle', 185, 0, 0, .12, .45, out);
          tone(t, 'triangle', 330, 0, 0, .08, .3, out);
          noiseSrc(t, .2).connect(filter('highpass', 2200)).connect(envGain(t, .45, .18, out));
        },
        hat: () => metal(t, .05, .35, out),
        openhat: () => metal(t, .38, .3, out),
        tom: () => tone(t, 'sine', 165, 118, .25, .6, .9, out),
        crash: () => metal(t, 1.2, .3, out, 5000)
      }[id];
      if (done) { done(); setTimeout(() => out.disconnect(), (t - ctx.currentTime + 2.2) * 1000); return; }
    }
    switch (id) {
      case 'kick':
        tone(t, 'sine', 160, 42, .11, .5, 1, out);
        noiseSrc(t, .02).connect(filter('highpass', 3000)).connect(envGain(t, .25, .02, out));
        break;
      case 'snare':
        noiseSrc(t, .25).connect(filter('highpass', 1400)).connect(envGain(t, .6, .22, out));
        tone(t, 'triangle', 220, 160, .08, .12, .5, out);
        break;
      case 'hat':
        noiseSrc(t, .06).connect(filter('highpass', 7500)).connect(envGain(t, .35, .055, out));
        break;
      case 'openhat':
        noiseSrc(t, .45).connect(filter('highpass', 7000)).connect(envGain(t, .3, .42, out));
        break;
      case 'clap': {
        const g = ctx.createGain();
        g.connect(out);
        noiseSrc(t, .3).connect(filter('bandpass', 1500, .9)).connect(g);
        g.gain.setValueAtTime(0, t);
        for (const k of [0, .011, .022]) {
          g.gain.setValueAtTime(.9, t + k);
          g.gain.exponentialRampToValueAtTime(.12, t + k + .01);
        }
        g.gain.setValueAtTime(.7, t + .033);
        g.gain.exponentialRampToValueAtTime(.0008, t + .24);
        break;
      }
      case 'tom':
        tone(t, 'sine', 210, 105, .3, .45, .9, out);
        break;
      case 'cowbell': {
        const bp = filter('bandpass', 2100, 1.4);
        bp.connect(envGain(t, .35, .3, out));
        for (const f of [545, 815]) {
          const o = ctx.createOscillator();
          o.type = 'square'; o.frequency.value = f;
          o.connect(bp); o.start(t); o.stop(t + .32);
        }
        break;
      }
      case 'crash':
        noiseSrc(t, 1.8).connect(filter('highpass', 4200)).connect(envGain(t, .45, 1.6, out));
        noiseSrc(t, .3).connect(filter('bandpass', 3000, .6)).connect(envGain(t, .2, .25, out));
        break;
      case 'click':
        tone(t, 'square', vel > 120 ? 1760 : 1320, 0, 0, .035, .35, out);
        break;
    }
    setTimeout(() => out.disconnect(), (t - ctx.currentTime + 2.2) * 1000);
  }

  apply();
  return {
    ctx, analyser, params: p,
    set(name, val) { p[name] = val; apply(); },
    setBpm(b) { bpm = b; apply(); },
    setKit(k) { currentKit = k; },
    loadSamples,
    samplesReady: () => (SAMPLES.inst.piano?.length || 0) > 0,
    // gravação do mestre (pós-compressor) para exportar
    async startCapture() {
      if (ctx.state !== 'running') await ctx.resume();
      if (!this._recReady) { await ctx.audioWorklet.addModule('rec-worklet.js'); this._recReady = true; }
      const node = new AudioWorkletNode(ctx, 'rec', { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [2] });
      const mute = ctx.createGain();
      mute.gain.value = 0;
      const chunks = [];
      node.port.onmessage = e => chunks.push(e.data);
      analyser.connect(node).connect(mute).connect(ctx.destination);
      this._cap = { node, mute, chunks };
    },
    stopCapture() {
      const { node, mute, chunks } = this._cap;
      this._cap = null;
      node.port.onmessage = null;
      analyser.disconnect(node);
      node.disconnect(); mute.disconnect();
      const n = chunks.reduce((s, c) => s + c[0].length, 0);
      const left = new Float32Array(n), right = new Float32Array(n);
      let o = 0;
      for (const [l, r] of chunks) { left.set(l, o); right.set(r, o); o += l.length; }
      return { left, right, rate: ctx.sampleRate };
    },
    // canal de volume de uma faixa de loop (síntese, bateria e bateria lo-fi passam por ele)
    // síntese: volume → pan → seco no mestre + envios próprios de reverb/delay (fx = quanto de efeito)
    // bateria: volume → pan → barramento da bateria
    bus(vol = 1, pan = 0, fx = 1) {
      const g = () => ctx.createGain();
      const b = { synth: g(), drum: g(), lofi: g(), sp: ctx.createStereoPanner(), dp: ctx.createStereoPanner(), rev: g(), del: g(), fx };
      b.synth.connect(b.sp);
      b.sp.connect(master);
      b.sp.connect(b.rev).connect(reverb);
      b.sp.connect(b.del).connect(delay);
      b.drum.connect(b.dp).connect(drumBus);
      b.lofi.connect(lofiIn);
      b.set = v => { for (const n of [b.synth, b.drum, b.lofi]) n.gain.setTargetAtTime(v, ctx.currentTime, .02); };
      b.setPan = v => { b.sp.pan.setTargetAtTime(v, ctx.currentTime, .02); b.dp.pan.setTargetAtTime(v, ctx.currentTime, .02); };
      b.setFx = v => { b.fx = v; b.sends(); };
      b.sends = () => {
        b.rev.gain.setTargetAtTime(p.reverb * .9 * b.fx, ctx.currentTime, .03);
        b.del.gain.setTargetAtTime(p.delay * .7 * b.fx, ctx.currentTime, .03);
      };
      b.dispose = () => { buses.delete(b); setTimeout(() => { for (const n of [b.synth, b.drum, b.lofi, b.sp, b.dp]) n.disconnect(); }, 3000); };
      b.set(vol);
      b.setPan(pan);
      b.sends();
      buses.add(b);
      return b;
    },
    setPreset(id) { currentPreset = PRESETS.find(x => x.id === id) || PRESETS[0]; currentVib = currentPreset.vib; setWheel(wheel); },
    noteOn, noteOff, panic, drum, setBend, setWheel,
    resume: () => ctx.state !== 'running' && ctx.resume()
  };
})();
