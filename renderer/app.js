// Overtone — teclado MIDI direto no navegador do Electron (Web MIDI + WebAudio).
const $ = s => document.querySelector(s);
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const noteName = n => NOTE_NAMES[n % 12] + (Math.floor(n / 12) - 1);

const KNOBS = [
  { id: 'volume', name: 'Volume', def: .8, fmt: v => Math.round(v * 100) + '%' },
  { id: 'cutoff', name: 'Filtro', def: .5, fmt: v => signed(v) },
  { id: 'reso', name: 'Ressonância', def: .15, fmt: pct },
  { id: 'attack', name: 'Ataque', def: .5, fmt: v => signed(v) },
  { id: 'release', name: 'Release', def: .5, fmt: v => signed(v) },
  { id: 'reverb', name: 'Reverb', def: .25, fmt: pct },
  { id: 'delay', name: 'Delay', def: 0, fmt: pct },
  { id: 'drums', name: 'Bateria', def: .8, fmt: pct }
];
function pct(v) { return Math.round(v * 100) + '%'; }
function signed(v) { const x = Math.round((v - .5) * 200); return (x > 0 ? '+' : x < 0 ? '−' : '') + Math.abs(x); }

const FUNCS = [
  { id: 'octDown', name: 'Oitava −', c: '#6f8bff' },
  { id: 'octUp', name: 'Oitava +', c: '#6f8bff' },
  { id: 'prev', name: 'Som anterior', c: '#22c3e6' },
  { id: 'next', name: 'Próximo som', c: '#22c3e6' },
  { id: 'sustain', name: 'Sustain', c: '#3ddc97', toggle: true },
  { id: 'rec', name: 'Gravar loop', c: '#ff5d6c', toggle: true },
  { id: 'loopNext', name: 'Próximo loop', c: '#ffbf47' },
  { id: 'play', name: 'Tocar / parar', c: '#8b90a4', toggle: true }
];

const SCALES = { maior: [0, 2, 4, 5, 7, 9, 11], menor: [0, 2, 3, 5, 7, 8, 10] };
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];

// ---------- estado salvo ----------
const DEFAULTS = {
  preset: 'piano', kit: 'acustico', knobs: KNOBS.map(k => k.def), padMode: 'drums', key: 0, scale: 'maior',
  oct: 0, trans: 0, bpm: 100, sustain: false,
  map: { knobs: Array(8).fill(null), pads: Array(8).fill(null) }
};
const S = (() => {
  try { return { ...structuredClone(DEFAULTS), ...JSON.parse(localStorage.getItem('overtone') || '{}') }; } catch { return structuredClone(DEFAULTS); }
})();
let saveT;
const save = () => { clearTimeout(saveT); saveT = setTimeout(() => localStorage.setItem('overtone', JSON.stringify(S)), 200); };

// ---------- notas ativas ----------
const held = new Map(); // origem -> { notes, handles }
let sustained = [];
let sustainPedal = false;
const sustainOn = () => S.sustain || sustainPedal;

function startNotes(src, notes, vel, preset = S.preset, record = true) {
  stopSrc(src, false);
  const handles = notes.map(n => Engine.noteOn(n, vel, preset));
  held.set(src, { notes, handles });
  if (record) loopRecord({ type: 'on', src, notes, vel, preset });
  showNotes();
}

function stopSrc(src, record = true) {
  const h = held.get(src);
  if (!h) return;
  held.delete(src);
  if (sustainOn()) sustained.push(...h.handles);
  else h.handles.forEach(Engine.noteOff);
  if (record) loopRecord({ type: 'off', src });
  showNotes();
}

function releaseSustain() {
  if (sustainOn()) return;
  sustained.forEach(Engine.noteOff);
  sustained = [];
}

function panic() {
  held.clear();
  sustained = [];
  Engine.panic();
  showNotes();
}

const playNote = n => Math.max(0, Math.min(127, n + S.oct * 12 + S.trans));

// ---------- sons ----------
function renderSounds() {
  $('#sound-list').innerHTML = PRESETS.map((p, i) => `
    ${i === 0 || PRESETS[i - 1].cat !== p.cat ? `<div class="cat">${p.cat}</div>` : ''}
    <button class="sound ${p.id === S.preset ? 'on' : ''}" data-id="${p.id}" style="--c:${p.c}">
      <span class="tile">${icon(p.icon, 18)}</span>
      <span><div class="nm">${p.name}</div><div class="ds">${p.desc}</div></span>
      <span class="n">${String(i + 1).padStart(2, '0')}</span>
    </button>`).join('');
}
function setPreset(id) {
  const p = PRESETS.find(x => x.id === id) || PRESETS[0];
  S.preset = p.id;
  Engine.setPreset(p.id);
  document.documentElement.style.setProperty('--c', p.c);
  for (const el of document.querySelectorAll('.sound')) el.classList.toggle('on', el.dataset.id === p.id);
  document.querySelector('.sound.on')?.scrollIntoView({ block: 'nearest' });
  save();
}
function stepPreset(d) {
  const i = PRESETS.findIndex(x => x.id === S.preset);
  setPreset(PRESETS[(i + d + PRESETS.length) % PRESETS.length].id);
  toast(icon('music') + PRESETS.find(x => x.id === S.preset).name);
}
$('#sound-list').addEventListener('click', e => {
  const b = e.target.closest('.sound');
  if (b) setPreset(b.dataset.id);
});

// ---------- oitava / transpor / sustain ----------
function renderSteppers() {
  $('#oct b').textContent = (S.oct > 0 ? '+' : '') + S.oct;
  $('#trans b').textContent = (S.trans > 0 ? '+' : '') + S.trans;
  $('#bpm b').textContent = S.bpm;
  $('#opt-sustain').checked = S.sustain;
  renderKeyboard();
}
function setOct(o) { S.oct = Math.max(-3, Math.min(3, o)); renderSteppers(); save(); }
$('#oct').addEventListener('click', e => { const b = e.target.closest('button'); if (b) setOct(S.oct + +b.dataset.d); });
$('#trans').addEventListener('click', e => {
  const b = e.target.closest('button');
  if (b) { S.trans = Math.max(-11, Math.min(11, S.trans + +b.dataset.d)); renderSteppers(); save(); }
});
function setSustain(on) {
  S.sustain = on;
  $('#opt-sustain').checked = on;
  releaseSustain();
  renderPads();
  save();
}
$('#opt-sustain').addEventListener('change', e => setSustain(e.target.checked));

// ---------- knobs ----------
const ARC = 2 * Math.PI * 24 * .75;
function renderKnobs() {
  $('#knob-grid').innerHTML = KNOBS.map((k, i) => `
    <div class="knob" data-i="${i}" title="Arraste, role a roda ou dê duplo clique para voltar ao padrão">
      <span class="k-map"></span>
      <svg width="62" height="62" viewBox="0 0 62 62">
        <circle class="track" cx="31" cy="31" r="24" fill="none" stroke-width="5" stroke-linecap="round"
          stroke-dasharray="${ARC} 999" transform="rotate(135 31 31)"/>
        <circle class="val" cx="31" cy="31" r="24" fill="none" stroke-width="5" stroke-linecap="round" transform="rotate(135 31 31)"/>
        <circle class="cap" cx="31" cy="31" r="16" stroke-width="1"/>
        <line class="ptr" x1="31" y1="31" x2="31" y2="19" stroke-width="2.5" stroke-linecap="round"/>
      </svg>
      <span class="k-name">${k.name}</span>
      <span class="k-val"></span>
    </div>`).join('');
  KNOBS.forEach((_, i) => drawKnob(i));
}
function drawKnob(i) {
  const el = document.querySelector(`.knob[data-i="${i}"]`);
  const v = S.knobs[i];
  el.querySelector('.val').setAttribute('stroke-dasharray', `${Math.max(.01, v * ARC)} 999`);
  el.querySelector('.ptr').setAttribute('transform', `rotate(${-135 + v * 270} 31 31)`);
  el.querySelector('.k-val').textContent = KNOBS[i].fmt(v);
  el.querySelector('.k-map').textContent = mapLabel(S.map.knobs[i]);
}
const knobFlash = {};
function setKnob(i, v, fromMidi) {
  v = Math.max(0, Math.min(1, v));
  S.knobs[i] = v;
  Engine.set(KNOBS[i].id, v);
  drawKnob(i);
  if (fromMidi) {
    const el = document.querySelector(`.knob[data-i="${i}"]`);
    el.classList.add('moved');
    clearTimeout(knobFlash[i]);
    knobFlash[i] = setTimeout(() => el.classList.remove('moved'), 500);
  }
  save();
}
(() => {
  const grid = $('#knob-grid');
  let drag = null;
  grid.addEventListener('pointerdown', e => {
    const k = e.target.closest('.knob');
    if (!k) return;
    if (mapping) return setLearn('knob', +k.dataset.i);
    drag = { i: +k.dataset.i, y: e.clientY, v: S.knobs[+k.dataset.i] };
    k.setPointerCapture(e.pointerId);
  });
  grid.addEventListener('pointermove', e => {
    if (!drag) return;
    setKnob(drag.i, drag.v + (drag.y - e.clientY) / (e.shiftKey ? 600 : 160));
  });
  grid.addEventListener('pointerup', () => { drag = null; });
  grid.addEventListener('wheel', e => {
    const k = e.target.closest('.knob');
    if (!k) return;
    e.preventDefault();
    setKnob(+k.dataset.i, S.knobs[+k.dataset.i] - Math.sign(e.deltaY) * .03);
  }, { passive: false });
  grid.addEventListener('dblclick', e => {
    const k = e.target.closest('.knob');
    if (k && !mapping) setKnob(+k.dataset.i, KNOBS[+k.dataset.i].def);
  });
})();

// ---------- pads ----------
function chordFor(i) {
  const sc = SCALES[S.scale];
  const deg = i % 7;
  const root = 60 + S.key + sc[deg] + (i === 7 ? 12 : 0);
  const at = k => sc[(deg + k) % 7] + ((deg + k) >= 7 ? 12 : 0) - sc[deg];
  const third = at(2), fifth = at(4);
  const q = third === 4 ? '' : fifth === 6 ? '°' : 'm';
  const name = NOTE_NAMES[(S.key + sc[deg]) % 12] + q;
  const roman = (q === '' ? ROMAN[deg] : ROMAN[deg].toLowerCase()) + (q === '°' ? '°' : '');
  return { notes: [root - 12, root, root + third, root + fifth], name, roman: i === 7 ? 'I 8ª' : roman };
}

function padInfo(i) {
  if (S.padMode === 'drums') return { name: DRUMS[i].name, sub: '', c: DRUMS[i].c };
  if (S.padMode === 'chords') {
    const ch = chordFor(i);
    return { name: ch.name, sub: ch.roman, c: PRESETS.find(p => p.id === S.preset).c };
  }
  const f = FUNCS[i];
  let sub = '';
  if (f.id === 'sustain') sub = sustainOn() ? 'ligado' : 'desligado';
  const tr = looper.tracks[looper.sel];
  if (f.id === 'rec') sub = looper.rec !== null ? 'gravando ' + looper.tracks[looper.rec].name : tr.name;
  if (f.id === 'loopNext') sub = 'agora ' + tr.name;
  if (f.id === 'play') sub = looper.playing ? 'tocando' : looper.len ? 'parado' : 'sem loop';
  if (f.id === 'octDown' || f.id === 'octUp') sub = 'agora ' + (S.oct > 0 ? '+' : '') + S.oct;
  if (f.id === 'prev' || f.id === 'next') sub = PRESETS.find(p => p.id === S.preset).name;
  const lit = (f.id === 'sustain' && sustainOn()) || (f.id === 'play' && looper.playing) || (f.id === 'rec' && looper.rec !== null);
  return { name: f.name, sub, c: f.c, lit };
}

function renderPads() {
  const grid = $('#pad-grid');
  if (!grid.children.length) {
    grid.innerHTML = Array.from({ length: 8 }, (_, i) => `
      <button class="pad" data-i="${i}"><span class="p-num">${i + 1}</span><span class="p-map"></span>
        <span class="p-name"></span><span class="p-sub"></span></button>`).join('');
  }
  for (const el of grid.children) {
    const i = +el.dataset.i, info = padInfo(i);
    el.style.setProperty('--c', info.c);
    el.querySelector('.p-name').textContent = info.name;
    el.querySelector('.p-sub').textContent = info.sub;
    el.querySelector('.p-map').textContent = mapLabel(S.map.pads[i]);
    el.classList.toggle('lit', !!info.lit);
  }
  for (const b of document.querySelectorAll('#pad-mode button')) b.classList.toggle('on', b.dataset.m === S.padMode);
  for (const b of document.querySelectorAll('#scale button')) b.classList.toggle('on', b.dataset.s === S.scale);
  for (const b of document.querySelectorAll('#kit button')) b.classList.toggle('on', b.dataset.k === S.kit);
  $('#chord-opts').classList.toggle('hidden', S.padMode !== 'chords');
  $('#kit-opts').classList.toggle('hidden', S.padMode !== 'drums');
}

const padTimers = {};
function flashPad(i, holdOn) {
  const el = $('#pad-grid').children[i];
  el.classList.add('hit');
  clearTimeout(padTimers[i]);
  if (!holdOn) padTimers[i] = setTimeout(() => el.classList.remove('hit'), 110);
}

function padDown(i, vel = 110) {
  if (S.padMode === 'drums') {
    Engine.drum(DRUMS[i].id, vel, 0, S.kit);
    loopRecord({ type: 'drum', id: DRUMS[i].id, vel, kit: S.kit });
    flashPad(i);
  } else if (S.padMode === 'chords') {
    startNotes('pad' + i, chordFor(i).notes, Math.min(vel, 105));
    flashPad(i, true);
  } else {
    flashPad(i);
    runFunc(FUNCS[i].id);
  }
}
function padUp(i) {
  if (S.padMode === 'chords') stopSrc('pad' + i);
  $('#pad-grid').children[i].classList.remove('hit');
}

function runFunc(id) {
  ({
    octDown: () => setOct(S.oct - 1),
    octUp: () => setOct(S.oct + 1),
    prev: () => stepPreset(-1),
    next: () => stepPreset(1),
    sustain: () => setSustain(!S.sustain),
    rec: () => loopRec(),
    loopNext: () => selectTrack(looper.sel + 1),
    play: () => loopPlay()
  })[id]();
  renderPads();
}

(() => {
  const grid = $('#pad-grid');
  grid.addEventListener('pointerdown', e => {
    const p = e.target.closest('.pad');
    if (!p) return;
    if (mapping) return setLearn('pad', +p.dataset.i);
    padDown(+p.dataset.i, 110);
    const up = () => { padUp(+p.dataset.i); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointerup', up);
  });
})();
$('#pad-mode').addEventListener('click', e => {
  const b = e.target.closest('button');
  if (!b) return;
  for (let i = 0; i < 8; i++) stopSrc('pad' + i);
  S.padMode = b.dataset.m;
  renderPads();
  save();
});
$('#kit').innerHTML = KITS.map(k => `<button data-k="${k.id}">${k.name}</button>`).join('');
$('#kit').addEventListener('click', e => {
  const b = e.target.closest('button');
  if (b) { S.kit = b.dataset.k; Engine.setKit(S.kit); renderPads(); save(); Engine.drum('kick', 110); }
});
$('#key').innerHTML = NOTE_NAMES.map((n, i) => `<option value="${i}">${n}</option>`).join('');
$('#key').addEventListener('change', e => { S.key = +e.target.value; renderPads(); save(); });
$('#scale').addEventListener('click', e => {
  const b = e.target.closest('button');
  if (b) { S.scale = b.dataset.s; renderPads(); save(); }
});

// ---------- teclado na tela ----------
let viewBase = 48;
function renderKeyboard() {
  viewBase = 48 + S.oct * 12;
  const kb = $('#keyboard');
  const whites = [];
  for (let n = viewBase; n <= viewBase + 24; n++) if (![1, 3, 6, 8, 10].includes(n % 12)) whites.push(n);
  const w = 100 / whites.length;
  let html = '';
  whites.forEach((n, i) => {
    html += `<div class="wk" data-n="${n}" style="left:${i * w}%;width:${w}%">${n % 12 === 0 ? `<span>${noteName(n)}</span>` : ''}</div>`;
  });
  for (let n = viewBase; n <= viewBase + 24; n++) {
    if (![1, 3, 6, 8, 10].includes(n % 12)) continue;
    const i = whites.indexOf(n - 1);
    html += `<div class="bk" data-n="${n}" style="left:${(i + 1) * w - w * .3}%;width:${w * .6}%"></div>`;
  }
  kb.innerHTML = html;
  showNotes();
}
(() => {
  const kb = $('#keyboard');
  let down = null;
  const play = el => {
    if (!el || !el.dataset.n) return;
    if (down === el.dataset.n) return;
    down = el.dataset.n;
    startNotes('mouse', [+el.dataset.n], 100);
  };
  kb.addEventListener('pointerdown', e => { kb.setPointerCapture(e.pointerId); play(e.target.closest('[data-n]')); });
  kb.addEventListener('pointermove', e => {
    if (down === null) return;
    play(document.elementFromPoint(e.clientX, e.clientY)?.closest('#keyboard [data-n]'));
  });
  const end = () => { if (down !== null) { down = null; stopSrc('mouse'); } };
  kb.addEventListener('pointerup', end);
  kb.addEventListener('pointercancel', end);
})();

function showNotes() {
  const on = new Set();
  for (const h of held.values()) h.notes.forEach(n => on.add(n));
  for (const el of document.querySelectorAll('#keyboard [data-n]')) el.classList.toggle('on', on.has(+el.dataset.n));
  const notes = [...on].sort((a, b) => a - b);
  if (notes.length) {
    $('#now-note').textContent = notes.length === 1 ? noteName(notes[0]) : noteName(notes[0]) + (notes.length > 1 ? '…' : '');
    $('#now-chord').textContent = detectChord(notes) || notes.map(noteName).join(' ');
  }
}

function detectChord(notes) {
  const pcs = [...new Set(notes.map(n => n % 12))];
  if (pcs.length < 3) return '';
  const shapes = [
    ['', [0, 4, 7]], ['m', [0, 3, 7]], ['°', [0, 3, 6]], ['aum', [0, 4, 8]], ['sus4', [0, 5, 7]], ['sus2', [0, 2, 7]],
    ['7', [0, 4, 7, 10]], ['7M', [0, 4, 7, 11]], ['m7', [0, 3, 7, 10]], ['m7(b5)', [0, 3, 6, 10]]
  ];
  let best = '';
  for (const r of pcs) {
    const set = pcs.map(p => (p - r + 12) % 12).sort((a, b) => a - b).join();
    for (const [q, iv] of shapes) if (iv.join() === set) best = NOTE_NAMES[r] + q;
  }
  const bass = notes[0] % 12;
  return best && !best.startsWith(NOTE_NAMES[bass]) ? `${best}/${NOTE_NAMES[bass]}` : best;
}

// ---------- teclado do PC ----------
const PC_KEYS = { KeyA: 0, KeyW: 1, KeyS: 2, KeyE: 3, KeyD: 4, KeyF: 5, KeyT: 6, KeyG: 7, KeyY: 8, KeyH: 9, KeyU: 10, KeyJ: 11, KeyK: 12, KeyO: 13, KeyL: 14, KeyP: 15, Semicolon: 16 };
window.addEventListener('keydown', e => {
  if (e.ctrlKey && e.code === 'KeyZ') return undoEdit();
  if (e.code === 'Delete' && looper.range) return cutRange();
  if (e.code === 'Escape' && looper.range) { looper.range = null; return renderLoops(); }
  if (e.target.tagName === 'SELECT' || e.ctrlKey || e.altKey || e.metaKey) return;
  if (e.repeat) { if (e.code in PC_KEYS || /^Digit[1-8]$/.test(e.code) || e.code === 'Space') e.preventDefault(); return; }
  Engine.resume();
  if (e.code in PC_KEYS) return startNotes('pc' + e.code, [playNote(48 + PC_KEYS[e.code])], 100);
  const d = /^Digit([1-8])$/.exec(e.code);
  if (d) return padDown(+d[1] - 1, 110);
  switch (e.code) {
    case 'KeyZ': return setOct(S.oct - 1);
    case 'KeyX': return setOct(S.oct + 1);
    case 'ArrowUp': e.preventDefault(); return stepPreset(-1);
    case 'ArrowDown': e.preventDefault(); return stepPreset(1);
    case 'Space': e.preventDefault(); return panic();
    case 'KeyR': return runFunc('rec');
    case 'KeyM': return toggleMetro();
    case 'Enter': e.preventDefault(); return loopPlay();
    case 'ArrowLeft': e.preventDefault(); return selectTrack(looper.sel - 1);
    case 'ArrowRight': e.preventDefault(); return selectTrack(looper.sel + 1);
    case 'Escape': if (mapping) toggleMapping(false); return;
  }
});
window.addEventListener('keyup', e => {
  if (e.code in PC_KEYS) stopSrc('pc' + e.code);
  const d = /^Digit([1-8])$/.exec(e.code);
  if (d) padUp(+d[1] - 1);
});
window.addEventListener('blur', () => { for (const k of [...held.keys()]) if (k.startsWith('pc') || k === 'mouse') stopSrc(k); });

// ---------- MIDI ----------
let mapping = false, learn = null;
const mapLabel = k => {
  if (!k) return '';
  const [t, ch, n] = k.split(':');
  return (t === 'c' ? 'CC' + n : noteName(+n)) + (ch !== '0' ? ` ·${+ch + 1}` : '');
};

function toggleMapping(on = !mapping) {
  mapping = on;
  learn = null;
  document.body.classList.toggle('mapping', on);
  $('#btn-map').classList.toggle('on', on);
  document.querySelectorAll('.learn').forEach(el => el.classList.remove('learn'));
  if (on) toast(icon('link') + 'Clique num knob ou pad e mexa no controle do teclado');
}
function setLearn(type, i) {
  learn = { type, i };
  document.querySelectorAll('.learn').forEach(el => el.classList.remove('learn'));
  document.querySelector(type === 'knob' ? `.knob[data-i="${i}"]` : `.pad[data-i="${i}"]`).classList.add('learn');
}
// o que liga sozinho fica em ordem de CC/nota (= ordem física no teclado); o mapeado à mão fica fixo
const mapLists = type => type === 'knob' ? [S.map.knobs, S.map.knobMan ||= Array(8).fill(false)] : [S.map.pads, S.map.padMan ||= Array(8).fill(false)];
function assign(type, i, key, manual = true) {
  for (const t of ['knob', 'pad']) {
    const [list, man] = mapLists(t);
    list.forEach((k, j) => { if (k === key) { list[j] = null; man[j] = false; } });
  }
  const [list, man] = mapLists(type);
  list[i] = key;
  man[i] = manual;
  sortAuto(type);
  save();
  KNOBS.forEach((_, j) => drawKnob(j));
  renderPads();
}
function sortAuto(type) {
  const [list, man] = mapLists(type);
  const slots = list.map((_, j) => j).filter(j => !man[j]);
  const keys = slots.map(j => list[j]).filter(Boolean).sort((a, b) => +a.split(':')[2] - +b.split(':')[2]);
  slots.forEach((j, n) => { list[j] = keys[n] ?? null; });
}
$('#btn-map').addEventListener('click', () => toggleMapping());
$('#btn-reset-map').addEventListener('click', () => {
  S.map = structuredClone(DEFAULTS.map);
  save();
  KNOBS.forEach((_, j) => drawKnob(j));
  renderPads();
  toast(icon('undo') + 'Mapeamento zerado — mexa nos knobs/pads para ligar de novo');
});
$('#btn-panic').addEventListener('click', panic);

let midiAccess = null;
function refreshInputs() {
  const ins = [...midiAccess.inputs.values()].filter(i => i.state === 'connected');
  for (const i of ins) i.onmidimessage = onMidi;
  const pill = $('#device');
  pill.classList.toggle('on', ins.length > 0);
  pill.classList.toggle('off', ins.length === 0);
  $('#device-name').textContent = ins.length ? ins.map(i => i.name).join(' + ') : 'Nenhum teclado — conecte o USB';
}

let blinkT, monT;
function monitor(text) {
  const dot = $('#device .dot');
  dot.classList.add('blink');
  clearTimeout(blinkT);
  blinkT = setTimeout(() => dot.classList.remove('blink'), 60);
  const m = $('#monitor');
  m.textContent = text;
  m.classList.add('fresh');
  clearTimeout(monT);
  monT = setTimeout(() => m.classList.remove('fresh'), 800);
}

function onMidi(e) {
  const [st, d1 = 0, d2 = 0] = e.data;
  if (st >= 0xF0) return; // clock / sysex
  const cmd = st & 0xF0, ch = st & 0x0F;
  const isOn = cmd === 0x90 && d2 > 0;
  const isOff = cmd === 0x80 || (cmd === 0x90 && d2 === 0);
  const nk = `n:${ch}:${d1}`, ck = `c:${ch}:${d1}`;

  if (isOn) monitor(`Nota ${noteName(d1)} (${d1}) · vel ${d2} · canal ${ch + 1}`);
  else if (cmd === 0xB0) monitor(`CC ${d1} = ${d2} · canal ${ch + 1}`);
  else if (cmd === 0xE0) monitor(`Pitch bend ${((d2 << 7) | d1) - 8192}`);
  else if (cmd === 0xC0) monitor(`Program ${d1} · canal ${ch + 1}`);

  // modo mapear: o próximo sinal vai para o alvo escolhido
  if (mapping && learn && (isOn || (cmd === 0xB0 && d2 > 0))) {
    if (learn.type === 'knob' && cmd !== 0xB0) return toast(icon('knob') + 'Knob precisa de um controle CC — gire um knob');
    assign(learn.type, learn.i, cmd === 0xB0 ? ck : nk);
    toast(icon('check') + `${learn.type === 'knob' ? KNOBS[learn.i].name : 'Pad ' + (learn.i + 1)} ← ${mapLabel(cmd === 0xB0 ? ck : nk)}`);
    document.querySelectorAll('.learn').forEach(el => el.classList.remove('learn'));
    learn = null;
    return;
  }

  if (isOn || isOff) {
    let pad = S.map.pads.indexOf(nk);
    // pads normalmente vêm no canal 10: liga automático no próximo pad livre
    if (pad < 0 && ch === 9 && isOn) {
      pad = S.map.pads.indexOf(null);
      if (pad >= 0) { assign('pad', pad, nk, false); pad = S.map.pads.indexOf(nk); toast(icon('grid') + `Pad ${pad + 1} ligado à nota ${d1}`); }
      else pad = d1 % 8;
    } else if (pad < 0 && ch === 9) pad = d1 % 8;
    if (pad >= 0) return isOn ? padDown(pad, d2) : padUp(pad);
    if (isOn) startNotes('m' + d1, [playNote(d1)], d2);
    else stopSrc('m' + d1);
    return;
  }

  if (cmd === 0xB0) {
    const pad = S.map.pads.indexOf(ck);
    if (pad >= 0) return d2 > 0 ? padDown(pad, d2) : padUp(pad);
    let knob = S.map.knobs.indexOf(ck);
    if (knob >= 0) return setKnob(knob, d2 / 127, true);
    if (d1 === 64) { sustainPedal = d2 >= 64; releaseSustain(); renderPads(); return; }
    if (d1 === 1) return Engine.setWheel(d2 / 127);
    if (d1 === 7) return setKnob(0, d2 / 127, true);
    if (d1 === 120 || d1 === 123) return panic();
    if (d1 >= 120) return;
    knob = S.map.knobs.indexOf(null);
    if (knob >= 0) {
      assign('knob', knob, ck, false);
      knob = S.map.knobs.indexOf(ck);
      toast(icon('knob') + `${KNOBS[knob].name} ligado ao CC ${d1}`);
      setKnob(knob, d2 / 127, true);
    }
    return;
  }

  if (cmd === 0xE0) return Engine.setBend((((d2 << 7) | d1) - 8192) / 8192 * 200);
  if (cmd === 0xC0) return setPreset(PRESETS[d1 % PRESETS.length].id);
}

async function initMidi() {
  if (!navigator.requestMIDIAccess) {
    $('#device-name').textContent = 'Web MIDI indisponível';
    return;
  }
  try {
    midiAccess = await navigator.requestMIDIAccess({ sysex: false });
    midiAccess.onstatechange = refreshInputs;
    refreshInputs();
  } catch (err) {
    $('#device').classList.add('off');
    $('#device-name').textContent = 'Sem permissão para MIDI';
    console.error(err);
  }
}

// ---------- metrônomo ----------
const metro = { on: false, next: 0, beat: 0, timer: null };
function toggleMetro(on = !metro.on) {
  metro.on = on;
  $('#t-metro').classList.toggle('on', on);
  clearInterval(metro.timer);
  if (on) {
    Engine.resume();
    metro.next = Engine.ctx.currentTime + .05;
    metro.beat = 0;
    metro.timer = setInterval(metroTick, 25);
  }
  renderLoops();
}
function metroTick() {
  const ctx = Engine.ctx;
  while (metro.next < ctx.currentTime + .12) {
    const accent = metro.beat % 4 === 0;
    Engine.drum('click', accent ? 127 : 90, metro.next);
    const delay = (metro.next - ctx.currentTime) * 1000;
    setTimeout(() => { const b = $('#t-metro'); b.classList.remove('beat'); void b.offsetWidth; b.classList.add('beat'); }, delay);
    metro.next += 60 / S.bpm;
    metro.beat++;
  }
}
$('#t-metro').addEventListener('click', () => toggleMetro());
$('#bpm').addEventListener('click', e => {
  const b = e.target.closest('button');
  if (!b) return;
  S.bpm = Math.max(40, Math.min(220, S.bpm + +b.dataset.d));
  Engine.setBpm(S.bpm);
  renderSteppers();
  renderPads();
  save();
});

// ---------- loops (várias faixas) ----------
// O primeiro loop gravado define o tamanho; os outros gravam por cima, no mesmo tamanho.
// Gravar numa faixa que já tem notas sobrepõe. Cada nota guarda o som/kit com que foi gravada.
const LOOP_COLORS = ['#22c3e6', '#ff9f6e', '#c084fc', '#3ddc97'];
const looper = {
  len: 0, start: 0, last: 0, playing: false, rec: null, waiting: false, sel: 0, timer: null, range: null, undo: [],
  tracks: LOOP_COLORS.map((c, i) => ({ c, name: 'Loop ' + (i + 1), events: [], mute: false }))
};
const now = () => performance.now();
const loopPos = () => looper.len ? (now() - looper.start) % looper.len : now() - looper.start;
const realSrcs = () => [...held.keys()].filter(k => !k.startsWith('L'));

function loopRecord(ev) {
  if (looper.rec === null) return;
  // armado: o primeiro loop só começa a contar na primeira nota/pad
  if (looper.waiting) {
    if (ev.type === 'off') return;
    looper.waiting = false;
    looper.start = now();
    renderLoops();
  }
  const tr = looper.tracks[looper.rec];
  // na sobreposição, não repete na mesma volta o que acabou de ser tocado
  tr.events.push({ ...ev, t: loopPos(), skip: looper.len ? now() + looper.len - 30 : 0 });
  tr.events.sort((a, b) => a.t - b.t);
  drawLane(looper.rec);
}

function loopRec(i = looper.sel) {
  Engine.resume();
  if (looper.rec === i) return endRec();
  if (looper.rec !== null) endRec();
  looper.sel = i;
  looper.rec = i;
  if (!looper.len) {
    looper.waiting = true;
    for (const tr of looper.tracks) tr.events = [];
  } else if (!looper.playing) loopPlay(true);
  ensureTimer();
  renderLoops();
}

function endRec() {
  const tr = looper.tracks[looper.rec];
  if (!looper.len) {
    if (looper.waiting) {
      looper.waiting = false;
      looper.rec = null;
      return renderLoops();
    }
    let len = now() - looper.start;
    if (metro.on) {
      const bar = 4 * 60000 / S.bpm;
      len = Math.max(1, Math.round(len / bar)) * bar;
    }
    if (len < 250 || !tr.events.length) {
      tr.events = [];
      looper.rec = null;
      return renderLoops();
    }
    looper.len = len;
    tr.events = tr.events.filter(e => e.t < len);
    for (const src of realSrcs()) tr.events.push({ type: 'off', src, t: len - 1, skip: 0 });
    looper.playing = true;
    looper.last = loopPos();
  } else {
    for (const src of realSrcs()) tr.events.push({ type: 'off', src, t: loopPos(), skip: now() + looper.len - 30 });
    tr.events.sort((a, b) => a.t - b.t);
  }
  const i = looper.rec;
  looper.rec = null;
  drawLane(i);
  renderLoops();
}

function loopPlay(on = !looper.playing) {
  if (!looper.len) {
    if (looper.rec !== null) endRec();
    return;
  }
  if (on && !looper.playing) {
    looper.playing = true;
    looper.start = now();
    looper.last = -1;
    ensureTimer();
  } else if (!on) {
    if (looper.rec !== null) endRec();
    looper.playing = false;
    releaseLoop();
  }
  renderLoops();
}

function releaseLoop(ti) {
  const pre = ti === undefined ? 'L' : `L${ti}:`;
  for (const k of [...held.keys()]) if (k.startsWith(pre)) stopSrc(k, false);
}

function selectTrack(i) {
  looper.sel = (i + looper.tracks.length) % looper.tracks.length;
  renderLoops();
}

function toggleMute(i) {
  const tr = looper.tracks[i];
  tr.mute = !tr.mute;
  if (tr.mute) releaseLoop(i);
  renderLoops();
}

function clearTrack(i) {
  snapshot();
  releaseLoop(i);
  looper.tracks[i].events = [];
  if (looper.rec === i) looper.rec = null;
  if (looper.tracks.every(t => !t.events.length)) resetLooper();
  drawLane(i);
  renderLoops();
}

function clearAll() {
  snapshot();
  releaseLoop();
  for (const tr of looper.tracks) tr.events = [];
  resetLooper();
  looper.tracks.forEach((_, i) => drawLane(i));
  renderLoops();
}

function resetLooper() {
  looper.len = 0;
  looper.playing = false;
  looper.rec = null;
  looper.waiting = false;
  looper.range = null;
}

function ensureTimer() {
  if (!looper.timer) looper.timer = setInterval(loopTick, 5);
}

function loopTick() {
  if (!looper.playing || !looper.len) return;
  const pos = loopPos();
  const fire = (a, b) => looper.tracks.forEach((tr, ti) => {
    if (tr.mute) return;
    for (const ev of tr.events) {
      if (ev.t <= a || ev.t > b || ev.skip > now()) continue;
      if (ev.type === 'drum') Engine.drum(ev.id, ev.vel, 0, ev.kit);
      else if (ev.type === 'on') {
        ev.key = `L${ti}:${ev.src}:${ev.t}`;
        startNotes(ev.key, ev.notes, ev.vel, ev.preset, false);
      } else offFor(tr, ev);
    }
  });
  if (pos < looper.last) { fire(looper.last, looper.len); fire(-1, pos); }
  else fire(looper.last, pos);
  looper.last = pos;
}

// solta o "on" mais recente da mesma origem
function offFor(tr, ev) {
  let match = null;
  for (const e of tr.events) if (e.type === 'on' && e.src === ev.src && e.key && held.has(e.key)) match = e;
  if (match) stopSrc(match.key, false);
}

// ---------- faixas na tela ----------
function renderLoops() {
  const host = $('#loop-tracks');
  if (!host.children.length) {
    host.innerHTML = looper.tracks.map((tr, i) => `
      <div class="ltrack" data-i="${i}" style="--c:${tr.c}">
        <span class="l-name"><span class="l-dot"></span>${tr.name}</span>
        <button class="icon-btn l-rec" title="Gravar nesta faixa (R)">${icon('record')}</button>
        <button class="icon-btn l-mute" title="Mudo"></button>
        <div class="lane" title="Arraste para selecionar um trecho (cortar / apagar)"><div class="marks"></div><span class="lsel"></span><span class="head"></span><em class="l-empty"></em></div>
        <span class="l-count mono"></span>
        <button class="icon-btn ghost l-clear" title="Apagar esta faixa">${icon('trash')}</button>
      </div>`).join('');
    looper.tracks.forEach((_, i) => drawLane(i));
  }
  looper.tracks.forEach((tr, i) => {
    const row = host.children[i];
    const n = tr.events.filter(e => e.type !== 'off').length;
    row.classList.toggle('sel', i === looper.sel);
    row.classList.toggle('rec', i === looper.rec);
    row.classList.toggle('muted', tr.mute);
    row.querySelector('.l-mute').innerHTML = icon(tr.mute ? 'mute' : 'volume');
    row.querySelector('.l-count').textContent = n || '';
    row.querySelector('.l-empty').textContent = n ? '' : i === looper.rec ? (looper.waiting ? 'armado · começa na primeira nota' : 'gravando…') : looper.len ? 'vazio · grava por cima no mesmo tamanho' : i === looper.sel ? 'vazio · R grava e define o tamanho' : 'vazio';
  });
  const playing = looper.playing;
  $('#t-play').classList.toggle('on', playing);
  $('#t-play').innerHTML = icon(playing ? 'stop' : 'play');
  let info = '';
  if (looper.len) {
    info = `${(looper.len / 1000).toFixed(1)}s`;
    if (metro.on) info += ` · ${Math.round(looper.len / (4 * 60000 / S.bpm))} compasso(s)`;
    if (!playing) info += ' · parado';
  } else if (looper.rec !== null) info = looper.waiting ? 'armado · toque algo para começar' : 'gravando o primeiro loop…';
  $('#loop-info').textContent = info;
  const r = looper.range;
  $('#edit-tools').classList.toggle('hidden', !r && !looper.undo.length);
  $('#e-keep').classList.toggle('hidden', !r);
  $('#e-cut').classList.toggle('hidden', !r);
  $('#e-undo').classList.toggle('hidden', !looper.undo.length);
  if (r) $('#e-range').textContent = `${looper.tracks[r.ti].name} · ${(r.a / 1000).toFixed(2)}–${(r.b / 1000).toFixed(2)}s`;
  else $('#e-range').textContent = '';
  looper.tracks.forEach((_, i) => {
    const el = $('#loop-tracks').children[i].querySelector('.lsel');
    el.style.display = r && r.ti === i ? 'block' : 'none';
    if (r && r.ti === i) { el.style.left = r.a / looper.len * 100 + '%'; el.style.width = (r.b - r.a) / looper.len * 100 + '%'; }
  });
  renderPads();
}

function drawLane(i) {
  const tr = looper.tracks[i];
  const row = $('#loop-tracks').children[i];
  if (!row) return;
  const ev = tr.events;
  const len = looper.len || Math.max(1000, ...ev.map(e => e.t)) * 1.15;
  const notes = ev.filter(e => e.type === 'on').flatMap(e => e.notes);
  const lo = Math.min(...notes), hi = Math.max(...notes);
  let html = '';
  for (const e of ev.slice(0, 600)) {
    const x = e.t / len * 100;
    if (e.type === 'drum') {
      const d = DRUMS.findIndex(dr => dr.id === e.id);
      html += `<i class="hitm" style="left:${x}%;top:${8 + (d % 4) * 4}px"></i>`;
    } else if (e.type === 'on') {
      const off = ev.find(o => o.type === 'off' && o.src === e.src && o.t > e.t);
      const end = off ? off.t : len;
      for (const n of e.notes) {
        const y = hi === lo ? 50 : 88 - (n - lo) / (hi - lo) * 76;
        html += `<i class="nm" style="left:${x}%;width:${Math.max(.4, (end - e.t) / len * 100)}%;top:${y}%"></i>`;
      }
    }
  }
  row.querySelector('.marks').innerHTML = html;
}

(() => {
  const host = $('#loop-tracks');
  host.addEventListener('click', e => {
    const row = e.target.closest('.ltrack');
    if (!row) return;
    const i = +row.dataset.i;
    if (e.target.closest('.l-rec')) return loopRec(i);
    if (e.target.closest('.l-mute')) return toggleMute(i);
    if (e.target.closest('.l-clear')) return clearTrack(i);
    if (e.target.closest('.lane') && looper.range?.moved) return;
    selectTrack(i);
  });
  // arrastar numa faixa seleciona um trecho (para cortar/apagar)
  let drag = null;
  const msAt = (lane, x) => {
    const r = lane.getBoundingClientRect();
    return Math.max(0, Math.min(1, (x - r.left) / r.width)) * looper.len;
  };
  host.addEventListener('pointerdown', e => {
    const lane = e.target.closest('.lane');
    if (!lane || !looper.len) return;
    const ti = +lane.closest('.ltrack').dataset.i;
    const a = msAt(lane, e.clientX);
    drag = { lane, ti, a };
    looper.range = null;
    lane.setPointerCapture(e.pointerId);
    renderLoops();
  });
  host.addEventListener('pointermove', e => {
    if (!drag) return;
    const b = msAt(drag.lane, e.clientX);
    if (Math.abs(b - drag.a) < looper.len * .01) return;
    looper.range = { ti: drag.ti, a: Math.min(drag.a, b), b: Math.max(drag.a, b), moved: true };
    looper.sel = drag.ti;
    renderLoops();
  });
  host.addEventListener('pointerup', () => { drag = null; });
  // cabeça de leitura
  const frame = () => {
    requestAnimationFrame(frame);
    const rows = host.children;
    if (looper.len && looper.playing) {
      const x = loopPos() / looper.len * 100 + '%';
      for (const r of rows) r.querySelector('.head').style.left = x;
    } else if (looper.rec !== null && !looper.len && !looper.waiting) {
      $('#loop-info').textContent = `gravando ${((now() - looper.start) / 1000).toFixed(1)}s · R fecha o loop`;
      if (Math.random() < .1) drawLane(looper.rec);
    }
    host.classList.toggle('moving', looper.playing);
  };
  frame();
})();

// ---------- edição: notas viram blocos (início/fim) e voltam a eventos ----------
function toBlocks(tr) {
  const blocks = [];
  tr.events.forEach((e, idx) => {
    if (e.type === 'drum') blocks.push({ ...e, end: e.t });
    if (e.type !== 'on') return;
    const off = tr.events.find((o, j) => j > idx && o.type === 'off' && o.src === e.src);
    blocks.push({ ...e, end: off ? off.t : looper.len });
  });
  return blocks;
}
function fromBlocks(blocks) {
  const ev = [];
  blocks.forEach((b, n) => {
    if (b.type === 'drum') return ev.push({ type: 'drum', id: b.id, vel: b.vel, kit: b.kit, t: b.t, skip: 0 });
    const src = 'e' + n; // origem única por nota editada
    ev.push({ type: 'on', src, notes: b.notes, vel: b.vel, preset: b.preset, t: b.t, skip: 0 });
    ev.push({ type: 'off', src, t: Math.max(b.t + 1, b.end), skip: 0 });
  });
  return ev.sort((x, y) => x.t - y.t);
}
function snapshot() {
  looper.undo.push({ len: looper.len, events: looper.tracks.map(t => t.events.map(e => ({ ...e, key: undefined }))) });
  if (looper.undo.length > 30) looper.undo.shift();
}

// mantém só o trecho: vira o novo tamanho de todos os loops
function keepRange() {
  const r = looper.range;
  if (!r) return;
  snapshot();
  releaseLoop();
  const len = r.b - r.a;
  for (const tr of looper.tracks) {
    tr.events = fromBlocks(toBlocks(tr)
      .filter(b => b.type === 'drum' ? b.t >= r.a && b.t < r.b : b.end > r.a && b.t < r.b)
      .map(b => ({ ...b, t: Math.max(0, b.t - r.a), end: Math.min(len - 1, b.end - r.a) })));
  }
  looper.len = len;
  looper.range = null;
  looper.start = now();
  looper.last = -1;
  looper.tracks.forEach((_, i) => drawLane(i));
  renderLoops();
  toast(icon('check') + `Loop cortado para ${(len / 1000).toFixed(2)}s`);
}

// apaga o trecho só da faixa selecionada; nota que entra no trecho é encurtada
function cutRange() {
  const r = looper.range;
  if (!r) return;
  snapshot();
  releaseLoop(r.ti);
  const tr = looper.tracks[r.ti];
  tr.events = fromBlocks(toBlocks(tr)
    .filter(b => !(b.t >= r.a && b.t < r.b))
    .map(b => b.type !== 'drum' && b.t < r.a && b.end > r.a ? { ...b, end: r.a } : b));
  looper.range = null;
  drawLane(r.ti);
  renderLoops();
}

function undoEdit() {
  const u = looper.undo.pop();
  if (!u) return;
  releaseLoop();
  looper.len = u.len;
  looper.tracks.forEach((tr, i) => { tr.events = u.events[i]; drawLane(i); });
  looper.range = null;
  if (u.len && !looper.playing) loopPlay(true);
  renderLoops();
  toast(icon('undo') + 'Edição desfeita');
}

$('#e-keep').addEventListener('click', keepRange);
$('#e-cut').addEventListener('click', cutRange);
$('#e-undo').addEventListener('click', undoEdit);
$('#t-play').addEventListener('click', () => loopPlay());
$('#t-clear').addEventListener('click', clearAll);

// ---------- osciloscópio ----------
(() => {
  const cv = $('#scope');
  const g = cv.getContext('2d');
  const buf = new Uint8Array(Engine.analyser.fftSize);
  const draw = () => {
    requestAnimationFrame(draw);
    Engine.analyser.getByteTimeDomainData(buf);
    const w = cv.width, h = cv.height;
    g.clearRect(0, 0, w, h);
    const grad = g.createLinearGradient(0, 0, w, 0);
    grad.addColorStop(0, '#5ef0b0'); grad.addColorStop(.5, '#22c3e6'); grad.addColorStop(1, '#6f8bff');
    g.strokeStyle = grad;
    g.lineWidth = 2;
    g.beginPath();
    // começa num cruzamento por zero para a onda ficar parada
    let s = 0;
    for (let i = 1; i < buf.length / 2; i++) if (buf[i - 1] < 128 && buf[i] >= 128) { s = i; break; }
    const n = 512;
    for (let i = 0; i < n; i++) {
      const y = h / 2 + (buf[s + i] - 128) / 128 * h * .45;
      i ? g.lineTo(i / n * w, y) : g.moveTo(0, y);
    }
    g.stroke();
  };
  draw();
})();

// ---------- toasts ----------
function toast(html) {
  const host = $('#toasts');
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = html;
  host.appendChild(el);
  while (host.children.length > 3) host.firstChild.remove();
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 220); }, 2200);
}

// ---------- início ----------
sortAuto('knob');
sortAuto('pad');
hydrateIcons();
renderSounds();
renderKnobs();
S.knobs.forEach((v, i) => Engine.set(KNOBS[i].id, v));
Engine.setBpm(S.bpm);
setPreset(S.preset);
$('#key').value = S.key;
renderSteppers();
renderPads();
Engine.setKit(S.kit);
renderLoops();
initMidi();
document.addEventListener('pointerdown', () => Engine.resume(), { once: true });
