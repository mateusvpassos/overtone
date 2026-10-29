// Overtone — ajustes (toque, metrônomo, swing, MIDI clock), escala travada, refazer e versões,
// faixa de microfone, modo show e modo aprender. Carrega por último e liga o app.

S.velCurve ??= 'normal';
S.metroSub ??= 1;
S.swing ??= 0;
S.clock ??= 'off';
S.lock ??= { scale: 'off', root: 0 };

// =====================================================================
// ajustes (engrenagem na barra de título)
// =====================================================================
function renderSettings() {
  $('#set-vel').value = S.velCurve;
  $('#set-sub').value = S.metroSub;
  $('#set-swing').value = S.swing;
  $('#set-swing-v').textContent = Math.round(S.swing * 100) + '%';
  $('#set-clock').value = S.clock;
}
$('#btn-settings').addEventListener('click', e => {
  const pop = $('#settings');
  pop.classList.toggle('hidden');
  if (pop.classList.contains('hidden')) return;
  renderSettings();
  const r = e.currentTarget.getBoundingClientRect();
  pop.style.top = r.bottom + 6 + 'px';
  pop.style.left = Math.max(8, r.right - pop.offsetWidth) + 'px';
});
document.addEventListener('pointerdown', e => {
  if (!e.target.closest('#settings, #btn-settings')) $('#settings').classList.add('hidden');
});
// ---------- sobre (versão, licença, créditos) ----------
async function openAbout() {
  $('#settings').classList.add('hidden');
  $('#about-version').textContent = (await window.api.about()).version;
  aboutNotices(false);
  $('#about-modal').classList.remove('hidden');
}
async function aboutNotices(on) {
  if (on && !$('#about-notices').textContent) $('#about-notices').textContent = await window.api.notices();
  $('#about-main').classList.toggle('hidden', on);
  $('#about-notices').classList.toggle('hidden', !on);
  $('#about-licenses span').textContent = on ? 'Voltar' : 'Licenças completas';
}
$('#btn-about').addEventListener('click', openAbout);
$('#btn-about-foot').addEventListener('click', openAbout);
$('#about-licenses').addEventListener('click', () => aboutNotices($('#about-notices').classList.contains('hidden')));
for (const b of document.querySelectorAll('#about-modal [data-open]')) b.addEventListener('click', () => window.api.openAbout(b.dataset.open));

$('#set-vel').addEventListener('change', e => { S.velCurve = e.target.value; save(); });
$('#set-sub').addEventListener('change', e => { S.metroSub = +e.target.value; save(); });
$('#set-swing').addEventListener('input', e => { S.swing = +e.target.value; renderSettings(); save(); });
$('#set-clock').addEventListener('change', e => { S.clock = e.target.value; save(); clockOutUpdate(); });

// curva de toque: suave = fácil chegar no forte; firme = precisa bater mais
function velCurve(v) {
  if (S.velCurve === 'fixa') return 100;
  const e = { suave: .6, normal: 1, firme: 1.6 }[S.velCurve] || 1;
  return Math.max(1, Math.min(127, Math.round(127 * (v / 127) ** e)));
}

// =====================================================================
// metrônomo com subdivisão (o swing entra no quantizar e no arpejador)
// =====================================================================
metroTick = function () {
  const ctx = Engine.ctx, sub = S.metroSub || 1;
  while (metro.next < ctx.currentTime + .12) {
    const k = metro.beat, onBeat = k % sub === 0, bar = Math.floor(k / sub) % 4 === 0;
    Engine.drum('click', onBeat ? (bar ? 127 : 90) : 45, metro.next);
    if (onBeat) {
      const delay = (metro.next - ctx.currentTime) * 1000;
      setTimeout(() => { const b = $('#t-metro'); b.classList.remove('beat'); void b.offsetWidth; b.classList.add('beat'); showBeat(bar); }, delay);
    }
    metro.next += 60 / S.bpm / sub;
    metro.beat++;
  }
};
// reinicia o relógio do metrônomo se já estava ligado (pega a função nova)
if (metro.on) toggleMetro(true);

// =====================================================================
// tamanho do teclado da tela
// =====================================================================
S.kbKeys ??= 25;
S.kbHeight ??= 'm';
$('#kb-keys').value = S.kbKeys;
$('#kb-height').value = S.kbHeight;
$('#kb-keys').addEventListener('change', e => { S.kbKeys = +e.target.value; renderKeyboard(); save(); });
$('#kb-height').addEventListener('change', e => { S.kbHeight = e.target.value; renderKeyboard(); save(); });

// =====================================================================
// escala travada: teclas fora da escala viram a nota da escala mais próxima
// =====================================================================
const LOCK_SCALES = {
  maior: [0, 2, 4, 5, 7, 9, 11], menor: [0, 2, 3, 5, 7, 8, 10],
  pentamaior: [0, 2, 4, 7, 9], pentamenor: [0, 3, 5, 7, 10], blues: [0, 3, 5, 6, 7, 10],
  dorico: [0, 2, 3, 5, 7, 9, 10], mixolidio: [0, 2, 4, 5, 7, 9, 10]
};
const inScale = n => S.lock.scale === 'off' || LOCK_SCALES[S.lock.scale].includes(((n - S.lock.root) % 12 + 12) % 12);
function snapNote(n) {
  if (inScale(n)) return n;
  for (let d = 1; d < 7; d++) {
    if (inScale(n - d)) return n - d;
    if (inScale(n + d)) return n + d;
  }
  return n;
}
function renderLock() {
  $('#lock-scale').value = S.lock.scale;
  $('#lock-root').value = S.lock.root;
  $('#lock-root').classList.toggle('hidden', S.lock.scale === 'off');
  for (const el of document.querySelectorAll('#keyboard [data-n]')) el.classList.toggle('off-scale', !inScale(+el.dataset.n));
}
$('#lock-root').innerHTML = NOTE_NAMES.map((n, i) => `<option value="${i}">${n}</option>`).join('');
$('#lock-scale').addEventListener('change', e => { S.lock.scale = e.target.value; renderLock(); save(); });
$('#lock-root').addEventListener('change', e => { S.lock.root = +e.target.value; renderLock(); save(); });
const _renderKeyboard = renderKeyboard;
renderKeyboard = function () { _renderKeyboard(); renderLock(); if (LEARN.on) learnShow(); };

// entradas de nota: escala travada + modo aprender
const _noteIn = noteIn, _noteOut = noteOut;
const PLAYED = new Map(); // origem -> notas tocadas agora (para o modo aprender)
noteIn = function (src, notes, vel) {
  if (S.lock.scale !== 'off' && !src.startsWith('pad')) notes = [...new Set(notes.map(snapNote))];
  PLAYED.set(src, notes);
  _noteIn(src, notes, vel);
  if (LEARN.on) learnInput(notes);
};
noteOut = function (src) {
  PLAYED.delete(src);
  _noteOut(src);
};

// =====================================================================
// swing no quantizar e no arpejador
// =====================================================================
const _quantizeTrack = quantizeTrack;
quantizeTrack = function (ti = looper.sel, strength = 1) {
  if (!S.swing) return _quantizeTrack(ti, strength);
  // quantiza na grade e depois atrasa as notas das posições ímpares
  const tr = looper.tracks[ti];
  if (!looper.len || !tr?.events.length) return _quantizeTrack(ti, strength);
  _quantizeTrack(ti, strength);
  const g = gridMs();
  releaseLoop(ti);
  tr.events = fromBlocks(toBlocks(tr).map(b => {
    const k = Math.round(b.t / g);
    if (k % 2 !== 1 || Math.abs(b.t - k * g) > 2) return b;
    const d = S.swing * g * strength;
    return { ...b, t: Math.min(looper.len - 2, b.t + d), end: Math.min(looper.len - 1, b.end + d) };
  }));
  drawLane(ti);
  renderLoops();
};

// =====================================================================
// refazer (Ctrl+Y) e versões dos mixes
// =====================================================================
looper.redo = [];
const curState = () => ({ len: looper.len, tracks: looper.tracks.map(trackData) });
const _snapshot = snapshot;
snapshot = function () { looper.redo = []; _snapshot(); renderRedo(); };
const _undoEdit = undoEdit;
undoEdit = function () {
  if (!looper.undo.length) return;
  looper.redo.push(curState());
  _undoEdit();
  renderRedo();
};
function redoEdit() {
  const r = looper.redo.pop();
  if (!r) return;
  looper.undo.push(curState());
  releaseLoop();
  looper.len = r.len;
  setTracks(r.tracks);
  if (r.len && !looper.playing) loopPlay(true);
  markDirty();
  renderLoops();
  renderRedo();
  toast(icon('redo') + 'Refeito');
}
function renderRedo() {
  $('#e-redo').classList.toggle('hidden', !looper.redo.length);
  if (looper.redo.length) $('#edit-tools').classList.remove('hidden');
}
$('#e-redo').addEventListener('click', redoEdit);
const _renderLoops = renderLoops;
renderLoops = function () {
  _renderLoops();
  if ($('#e-redo')) renderRedo();
  // faixa com áudio gravado não está vazia
  looper.tracks.forEach((t, i) => { const row = $('#loop-tracks').children[i]; if (t.audio && row) row.querySelector('.l-empty').textContent = ''; });
};

// versões: cada vez que salva por cima, o anterior vai para o histórico
const _renderMixList = renderMixList;
renderMixList = async function () {
  await _renderMixList();
  for (const item of document.querySelectorAll('.mix-item')) {
    const b = document.createElement('button');
    b.className = 'icon-btn ghost m-ver';
    b.title = 'Versões anteriores';
    b.innerHTML = icon('history');
    item.insertBefore(b, item.querySelector('.m-del'));
  }
};
$('#mix-list').addEventListener('click', async e => {
  const b = e.target.closest('.m-ver');
  if (b) {
    e.stopPropagation();
    const item = b.closest('.mix-item'), file = item.dataset.file;
    const old = item.nextElementSibling?.classList.contains('ver-list') ? item.nextElementSibling : null;
    if (old) return old.remove();
    const list = await window.api.mixVersions(file);
    const box = document.createElement('div');
    box.className = 'ver-list';
    box.innerHTML = list.length ? list.map(v => `
      <div class="ver"><span class="mono small">${new Date(v.saved).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
        <span class="muted small">${v.tracks} faixas · ${((v.len || 0) / 1000).toFixed(1)}s</span><span class="spacer"></span>
        <button class="small-btn v-load" data-file="${escapeHtml(file)}" data-id="${escapeHtml(v.id)}">${icon('undo')}Voltar pra esta</button></div>`).join('')
      : '<div class="muted small ver">Sem versões anteriores ainda — elas aparecem a cada vez que você salva por cima.</div>';
    item.after(box);
    return;
  }
  const v = e.target.closest('.v-load');
  if (!v) return;
  const d = await window.api.mixVersionLoad(v.dataset.file, v.dataset.id);
  applyMixData(d);
  Object.assign(mix, { name: d.name, file: v.dataset.file, dirty: true });
  renderMixName();
  closeMixes();
  toast(icon('undo') + 'Versão anterior aberta · Ctrl+S salva por cima (a atual vira versão)');
}, true);

// =====================================================================
// MIDI clock: seguir outro app (BPM, play, stop) ou enviar o nosso
// =====================================================================
const CLK = { ticks: [], timer: null, next: 0, count: 0 };
function clockIn(st) {
  if (S.clock !== 'in') return;
  if (st === 0xF8) {
    const t = now();
    CLK.ticks.push(t);
    if (CLK.ticks.length > 49) CLK.ticks.shift();
    if (++CLK.count % 24 === 0 && CLK.ticks.length > 24) {
      const avg = (CLK.ticks.at(-1) - CLK.ticks[0]) / (CLK.ticks.length - 1);
      const bpm = Math.round(60000 / (avg * 24));
      if (bpm >= 30 && bpm <= 300 && Math.abs(bpm - S.bpm) >= 1) { S.bpm = bpm; Engine.setBpm(bpm); renderSteppers(); }
    }
  } else if (st === 0xFA || st === 0xFB) {
    if (looper.len) { loopPlay(false); loopPlay(true); }
  } else if (st === 0xFC) loopPlay(false);
}
const outs = () => midiAccess ? [...midiAccess.outputs.values()].filter(o => o.state === 'connected') : [];
function clockOutUpdate() {
  const run = S.clock === 'out' && (looper.playing || metro.on);
  if (run && !CLK.timer) {
    CLK.next = now();
    CLK.timer = setInterval(() => {
      const step = 60000 / S.bpm / 24;
      while (CLK.next < now() + 60) {
        for (const o of outs()) { try { o.send([0xF8], CLK.next); } catch {} }
        CLK.next += step;
      }
    }, 15);
  } else if (!run && CLK.timer) {
    clearInterval(CLK.timer);
    CLK.timer = null;
  }
}
const _loopPlay = loopPlay;
loopPlay = function (on = !looper.playing) {
  const was = looper.playing;
  _loopPlay(on);
  if (S.clock === 'out' && was !== looper.playing) for (const o of outs()) { try { o.send([looper.playing ? 0xFA : 0xFC]); } catch {} }
  if (!looper.playing) stopAudioTracks();
  clockOutUpdate();
};
const _toggleMetro = toggleMetro;
toggleMetro = function (on) { _toggleMetro(on); clockOutUpdate(); };

// =====================================================================
// faixa de microfone: grava uma volta inteira do loop
// =====================================================================
const MIC = { arm: null, rec: null, sources: new Map() };

async function micArm(ti) {
  if (!looper.len) return toast(icon('mic') + 'Grave um loop antes (ou crie 1 compasso em Passos)');
  try { await Engine.startMic(); } catch (e) { console.error(e); return toast(icon('x') + 'Não consegui abrir o microfone'); }
  MIC.arm = ti;
  if (!looper.playing) loopPlay(true);
  looper.sel = ti;
  renderLoops();
  toast(icon('mic') + 'Microfone armado: grava a próxima volta inteira');
}
function micCancel() {
  MIC.arm = MIC.rec = null;
  Engine.micRecord(false);
  Engine.stopMic();
  renderLoops();
}
// chamado na virada do loop
async function micWrap() {
  if (MIC.rec !== null) {
    const ti = MIC.rec;
    MIC.rec = null;
    const raw = Engine.micRecord(false);
    Engine.stopMic();
    // compensa a latência (o que entra no mic chega atrasado) e corta no tamanho do loop
    const rate = raw.sampleRate, n = Math.round(looper.len / 1000 * rate), skip = Math.round((Engine.latency() + .01) * rate);
    const L = new Float32Array(n), R = new Float32Array(n);
    L.set(raw.getChannelData(0).subarray(skip, skip + n));
    R.set(raw.getChannelData(1).subarray(skip, skip + n));
    snapshot();
    const tr = looper.tracks[ti];
    tr.audio = Engine.makeBuffer(L, R, rate);
    tr.audioFile = await window.api.saveAudio(rate, L, R);
    if (tr.name.startsWith('Loop ')) tr.name = 'Microfone';
    drawLane(ti);
    renderLoops();
    markDirty();
    toast(icon('check') + `${escapeHtml(tr.name)}: áudio gravado`);
  }
  if (MIC.arm !== null) {
    MIC.rec = MIC.arm;
    MIC.arm = null;
    Engine.micRecord(true);
    renderLoops();
  }
}
function stopAudioTracks(id) {
  for (const [k, s] of MIC.sources) if (id === undefined || k === id) { try { s.stop(); } catch {} MIC.sources.delete(k); }
}
function startAudioTracks(pos) {
  for (const tr of looper.tracks) {
    if (!tr.audio || tr.mute) continue;
    stopAudioTracks(tr.id);
    MIC.sources.set(tr.id, Engine.playBuffer(tr.audio, tr.bus, pos / 1000));
  }
}
const _loopTick = loopTick;
loopTick = function () {
  const live = looper.playing && looper.len && now() >= looper.start;
  const was = looper.last, pos = live ? loopPos() : null;
  _loopTick();
  if (pos === null) return;
  if (was === -1 || pos < was) { startAudioTracks(pos); micWrap(); }
};
if (looper.timer) { clearInterval(looper.timer); looper.timer = null; ensureTimer(); }

const _toggleMute = toggleMute;
toggleMute = function (i) {
  _toggleMute(i);
  const tr = looper.tracks[i];
  if (tr.mute) stopAudioTracks(tr.id);
  else if (tr.audio && looper.playing && looper.len) { stopAudioTracks(tr.id); MIC.sources.set(tr.id, Engine.playBuffer(tr.audio, tr.bus, loopPos() / 1000)); }
};
const _clearTrack = clearTrack;
clearTrack = function (i) {
  const tr = looper.tracks[i];
  if (tr.audio) { snapshot(); stopAudioTracks(tr.id); tr.audio = null; tr.audioFile = null; drawLane(i); renderLoops(); return; }
  _clearTrack(i);
};

// forma de onda na faixa
const _drawLane = drawLane;
drawLane = function (i) {
  _drawLane(i);
  const tr = looper.tracks[i], row = $('#loop-tracks').children[i];
  if (!tr?.audio || !row || !looper.len) return;
  const d = tr.audio.getChannelData(0), cols = 160, per = Math.floor(d.length / cols) || 1;
  let path = '';
  for (let c = 0; c < cols; c++) {
    let pk = 0;
    for (let k = c * per; k < (c + 1) * per && k < d.length; k += 8) pk = Math.max(pk, Math.abs(d[k]));
    const h = Math.min(1, pk * 1.6) * 11;
    path += `M${c + .5} ${13 - h}V${13 + h}`;
  }
  const w = tr.audio.duration * 1000 / looper.len * 100;
  row.querySelector('.marks').insertAdjacentHTML('beforeend', `<svg class="wave" viewBox="0 0 ${cols} 26" preserveAspectRatio="none" style="width:${w}%"><path d="${path}"/></svg>`);
  const cnt = row.querySelector('.l-count');
  if (!tr.events.length) cnt.textContent = '♪';
};
// mostra armado/gravando na faixa e o nível do mic
(() => {
  const frame = () => {
    requestAnimationFrame(frame);
    const rows = $('#loop-tracks').children;
    for (let i = 0; i < rows.length; i++) {
      rows[i].classList.toggle('mic-arm', MIC.arm === i);
      rows[i].classList.toggle('mic-rec', MIC.rec === i);
    }
    if (MIC.arm !== null || MIC.rec !== null) {
      const lv = Math.round(Engine.micLevel() * 100);
      $('#loop-info').textContent = (MIC.rec !== null ? 'gravando microfone' : 'mic armado · começa na virada') + ` · nível ${'▮'.repeat(Math.min(10, Math.ceil(lv / 10)))}${lv > 95 ? ' (alto demais!)' : ''}`;
    }
  };
  frame();
})();

// dados do mix: o áudio vai como arquivo, não dentro do .json
const _mixData = mixData;
mixData = function () {
  const d = _mixData();
  d.tracks.forEach(t => delete t.audio);
  return d;
};
const _applyMixData = applyMixData;
applyMixData = function (d) {
  stopAudioTracks();
  _applyMixData(d);
  for (const [i, tr] of looper.tracks.entries()) {
    if (!tr.audioFile || tr.audio) continue;
    window.api.readAudio(tr.audioFile)
      .then(u8 => Engine.decode(u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength)))
      .then(buf => { tr.audio = buf; drawLane(i); renderLoops(); })
      .catch(() => toast(icon('x') + `Áudio de ${escapeHtml(tr.name)} não encontrado`));
  }
};

// botões no popover da faixa
document.querySelector('#track-pop .pop-acts').addEventListener('click', e => {
  const b = e.target.closest('button[data-a="mic"]');
  if (!b) return;
  e.stopImmediatePropagation();
  $('#track-pop').classList.add('hidden');
  if (MIC.arm !== null || MIC.rec !== null) return micCancel();
  micArm(popTi);
}, true);

// efeitos de inserção no popover da faixa
const INS = [['low', 'Grave', -12, 12, 'dB'], ['mid', 'Médio', -12, 12, 'dB'], ['high', 'Agudo', -12, 12, 'dB'], ['drive', 'Drive', 0, 1, '%'], ['chorus', 'Chorus', 0, 1, '%'], ['comp', 'Compressor', 0, 1, '%']];
$('#tp-ins').innerHTML = INS.map(([k, n, a, b]) => `
  <label class="pop-row"><span>${n}</span><input type="range" data-k="${k}" min="${a}" max="${b}" step="${b > 1 ? .5 : .01}" title="Duplo clique zera"><em class="mono" data-v="${k}"></em></label>`).join('');
function renderIns() {
  const tr = looper.tracks[popTi];
  for (const [k, , , b, u] of INS) {
    const v = tr.ins?.[k] || 0;
    $(`#tp-ins input[data-k="${k}"]`).value = v;
    $(`#tp-ins [data-v="${k}"]`).textContent = u === 'dB' ? (v > 0 ? '+' : '') + v + 'dB' : Math.round(v * 100) + '%';
  }
  $('#tp-mic').innerHTML = icon('mic') + (MIC.arm !== null || MIC.rec !== null ? 'Cancelar mic' : tr.audio ? 'Regravar mic' : 'Microfone');
}
const _openTrackPop = openTrackPop;
openTrackPop = function (i, anchor) { popTi = i; renderIns(); _openTrackPop(i, anchor); };
$('#tp-ins').addEventListener('input', e => {
  const k = e.target.dataset.k;
  if (!k) return;
  const tr = looper.tracks[popTi];
  tr.ins = { ...tr.ins, [k]: +e.target.value };
  tr.bus.setInsert(tr.ins);
  renderIns();
  markDirty();
});
$('#tp-ins').addEventListener('dblclick', e => {
  if (!e.target.dataset.k) return;
  e.target.value = 0;
  e.target.dispatchEvent(new Event('input', { bubbles: true }));
});

// =====================================================================
// modo show: tela grande pra tocar ao vivo
// =====================================================================
const SHOW = { on: false };
function toggleShow(on = !SHOW.on) {
  SHOW.on = on;
  $('#show').classList.toggle('hidden', !on);
  window.api.setFullscreen(on);
  if (on) renderShow();
}
function renderShow() {
  if (!SHOW.on) return;
  const p = PRESETS.find(x => x.id === S.preset);
  $('#sh-mix').textContent = mix.name || 'Mix sem nome';
  $('#sh-sound').textContent = p?.name || '';
  $('#sh-sound').style.color = p?.c || '';
  $('#sh-bpm').textContent = S.bpm;
  $('#sh-play').innerHTML = icon(looper.playing ? 'stop' : 'play', 46);
  $('#sh-play').classList.toggle('on', looper.playing);
  $('#sh-metro').classList.toggle('on', metro.on);
  $('#sh-scenes').innerHTML = SCENE_NAMES.split('').map((n, i) => `
    <button class="sh-scene ${scenes.list[i] ? 'has' : ''} ${scenes.cur === i ? 'on' : ''} ${scenes.pending === i ? 'pending' : ''}" data-i="${i}" style="--c:${SCENE_COLORS[i]}">
      <b>${n}</b><span>${scenes.list[i] ? looper.tracks.filter(t => scenes.list[i].mutes[t.id] === false).length + ' faixas' : 'vazia'}</span></button>`).join('');
  $('#sh-tracks').innerHTML = looper.tracks.map((t, i) => `
    <button class="sh-track ${t.mute ? 'muted' : ''}" data-i="${i}" style="--c:${t.c}"><span class="l-dot"></span>${escapeHtml(t.name)}</button>`).join('');
}
function showBeat(bar) {
  if (!SHOW.on) return;
  const b = $('#sh-beat');
  b.classList.remove('flash', 'bar');
  void b.offsetWidth;
  b.classList.add('flash');
  if (bar) b.classList.add('bar');
}
$('#btn-show').addEventListener('click', () => toggleShow(true));
$('#sh-exit').addEventListener('click', () => toggleShow(false));
$('#sh-play').addEventListener('click', () => { loopPlay(); renderShow(); });
$('#sh-metro').addEventListener('click', () => { toggleMetro(); renderShow(); });
$('#sh-bpm-box').addEventListener('click', e => {
  const b = e.target.closest('button[data-d]');
  if (!b) return;
  S.bpm = Math.max(40, Math.min(220, S.bpm + +b.dataset.d));
  Engine.setBpm(S.bpm);
  renderSteppers();
  renderShow();
  save();
});
$('#sh-scenes').addEventListener('click', e => {
  const b = e.target.closest('.sh-scene');
  if (!b) return;
  if (e.shiftKey) sceneSave(+b.dataset.i); else sceneRecall(+b.dataset.i);
  renderShow();
});
$('#sh-tracks').addEventListener('click', e => {
  const b = e.target.closest('.sh-track');
  if (b) { toggleMute(+b.dataset.i); renderShow(); }
});
(() => {
  let last = '';
  const frame = () => {
    requestAnimationFrame(frame);
    if (!SHOW.on) return;
    const prog = looper.len && looper.playing ? loopPos() / looper.len : 0;
    $('#sh-ring').style.setProperty('--p', prog);
    const key = [looper.playing, scenes.cur, scenes.pending, S.preset, S.bpm, metro.on, looper.tracks.map(t => t.mute).join()].join('|');
    if (key !== last) { last = key; renderShow(); }
  };
  frame();
})();

// =====================================================================
// modo aprender: música (.mid), acordes e escalas — espera você acertar
// =====================================================================
const LEARN = { on: false, tab: 'song', steps: [], i: 0, hits: 0, miss: 0, octave: true, song: null, sel: new Set(), wrongT: null };

function parseMidi(u8) {
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  let p = 0;
  const str = n => String.fromCharCode(...u8.slice(p, p + n));
  if (str(4) !== 'MThd') throw new Error('não é um arquivo MIDI');
  const ntr = dv.getUint16(10), ppq = dv.getUint16(12) & 0x7fff;
  p = 8 + dv.getUint32(4);
  let tempo = 500000;
  const tracks = [];
  for (let t = 0; t < ntr && p < u8.length; t++) {
    if (str(4) !== 'MTrk') break;
    const len = dv.getUint32(p + 4), end = p + 8 + len;
    p += 8;
    let tick = 0, run = 0, name = '';
    const open = new Map(), notes = [];
    const vlq = () => { let v = 0, b; do { b = u8[p++]; v = (v << 7) | (b & 0x7f); } while (b & 0x80); return v; };
    while (p < end) {
      tick += vlq();
      let st = u8[p];
      if (st & 0x80) p++; else st = run;
      if (st === 0xff) {
        const type = u8[p++], l = vlq();
        if (type === 0x03 && !name) name = new TextDecoder('latin1').decode(u8.slice(p, p + l));
        if (type === 0x51) tempo = (u8[p] << 16) | (u8[p + 1] << 8) | u8[p + 2];
        p += l;
        continue;
      }
      if (st === 0xf0 || st === 0xf7) { p += vlq(); continue; }
      run = st;
      const cmd = st & 0xf0, ch = st & 15, a = u8[p++], b = (cmd === 0xc0 || cmd === 0xd0) ? 0 : u8[p++];
      if (cmd === 0x90 && b > 0) open.set(ch * 128 + a, { tick, note: a, ch });
      else if (cmd === 0x80 || (cmd === 0x90 && b === 0)) {
        const o = open.get(ch * 128 + a);
        if (o) { notes.push({ ...o, dur: tick - o.tick }); open.delete(ch * 128 + a); }
      }
    }
    p = end;
    if (notes.length) tracks.push({ name: name || `Trilha ${tracks.length + 1}`, notes: notes.filter(n => n.ch !== 9), drums: notes.some(n => n.ch === 9) });
  }
  return { ppq, tempo, tracks: tracks.filter(t => t.notes.length) };
}

function buildSongSteps() {
  const s = LEARN.song;
  const notes = s.tracks.filter((_, i) => LEARN.sel.has(i)).flatMap(t => t.notes).sort((a, b) => a.tick - b.tick);
  const tol = s.ppq / 16, steps = [];
  for (const n of notes) {
    const last = steps.at(-1);
    if (last && n.tick - last.tick <= tol) { if (!last.notes.includes(n.note)) last.notes.push(n.note); }
    else steps.push({ tick: n.tick, notes: [n.note] });
  }
  steps.forEach(st => st.notes.sort((a, b) => a - b));
  return steps;
}
function chordSteps() {
  const out = [];
  for (let k = 0; k < 24; k++) {
    const i = Math.floor(Math.random() * 7), c = chordFor(i);
    out.push({ notes: c.notes.slice(1), label: c.name });
  }
  return out;
}
function scaleSteps() {
  const sc = SCALES[S.scale], base = 60 + S.key, up = [...sc.map(x => base + x), base + 12];
  return [...up, ...up.slice(0, -1).reverse()].map(n => ({ notes: [n] }));
}

function learnStart(tab = LEARN.tab) {
  LEARN.tab = tab;
  LEARN.i = LEARN.hits = LEARN.miss = 0;
  LEARN.steps = tab === 'song' ? (LEARN.song ? buildSongSteps() : []) : tab === 'chords' ? chordSteps() : scaleSteps();
  LEARN.on = LEARN.steps.length > 0;
  learnRender();
  learnShow();
}
const pcs = ns => new Set(ns.map(n => n % 12));
function learnInput(notes) {
  const st = LEARN.steps[LEARN.i];
  if (!st) return;
  const want = LEARN.octave || LEARN.tab === 'chords' ? pcs(st.notes) : new Set(st.notes);
  const val = n => LEARN.octave || LEARN.tab === 'chords' ? n % 12 : n;
  if (notes.some(n => !want.has(val(n)))) {
    LEARN.miss++;
    const k = $('#learn-step');
    k.classList.remove('wrong'); void k.offsetWidth; k.classList.add('wrong');
  }
  const down = new Set([...PLAYED.values()].flat().map(val));
  if ([...want].every(n => down.has(n))) {
    LEARN.hits++;
    LEARN.i++;
    if (LEARN.i >= LEARN.steps.length) {
      const acc = Math.round(LEARN.hits / Math.max(1, LEARN.hits + LEARN.miss) * 100);
      toast(icon('check') + `Terminou! Precisão ${acc}%`);
      if (LEARN.tab === 'chords') return learnStart('chords');
      LEARN.i = LEARN.steps.length;
    }
    learnRender();
    learnShow();
  } else learnRender();
}
function stepLabel(st) {
  if (!st) return '';
  if (st.label) return st.label;
  const ch = st.notes.length > 2 ? detectChord(st.notes) : '';
  return (ch ? ch + ' · ' : '') + st.notes.map(n => LEARN.octave ? NOTE_NAMES[n % 12] : noteName(n)).join(' ');
}
function learnRender() {
  for (const b of document.querySelectorAll('#learn-tabs button')) b.classList.toggle('on', b.dataset.t === LEARN.tab);
  $('#learn-song').classList.toggle('hidden', LEARN.tab !== 'song');
  const s = LEARN.song;
  $('#learn-file').textContent = s ? s.name : 'nenhuma música aberta';
  $('#learn-tracks').innerHTML = s ? s.tracks.map((t, i) => `<label class="chk"><input type="checkbox" data-i="${i}" ${LEARN.sel.has(i) ? 'checked' : ''}>${escapeHtml(t.name)} <span class="muted small">(${t.notes.length})</span></label>`).join('') : '';
  const st = LEARN.steps[LEARN.i];
  const total = LEARN.steps.length;
  $('#learn-step').textContent = !total ? (LEARN.tab === 'song' ? 'Abra um arquivo .mid' : '') : st ? stepLabel(st) : 'Fim! 🎉';
  $('#learn-next').innerHTML = LEARN.steps.slice(LEARN.i + 1, LEARN.i + 5).map(x => `<span>${escapeHtml(stepLabel(x))}</span>`).join('');
  $('#learn-bar').style.width = total ? LEARN.i / total * 100 + '%' : '0';
  const acc = LEARN.hits + LEARN.miss ? Math.round(LEARN.hits / (LEARN.hits + LEARN.miss) * 100) : 100;
  $('#learn-stats').textContent = total ? `${Math.min(LEARN.i + 1, total)}/${total} · acertos ${LEARN.hits} · erros ${LEARN.miss} · precisão ${acc}%` : '';
  $('#learn-oct').checked = LEARN.octave;
}
// acende no teclado da tela as notas que faltam tocar
function learnShow() {
  const st = LEARN.on ? LEARN.steps[LEARN.i] : null;
  const want = st ? st.notes : [];
  const pc = LEARN.octave || LEARN.tab === 'chords';
  const set = pc ? pcs(want) : new Set(want);
  for (const el of document.querySelectorAll('#keyboard [data-n]')) {
    const n = +el.dataset.n;
    el.classList.toggle('learn', !!st && set.has(pc ? n % 12 : n));
  }
}
async function learnOpen() {
  const r = await window.api.openMidi();
  if (!r) return;
  try {
    const s = parseMidi(r.bytes);
    if (!s.tracks.length) return toast(icon('x') + 'Esse .mid não tem notas (só bateria?)');
    s.name = r.name;
    LEARN.song = s;
    // começa com a trilha que tem mais notas
    const best = s.tracks.reduce((a, t, i) => t.notes.length > s.tracks[a].notes.length ? i : a, 0);
    LEARN.sel = new Set([best]);
    learnStart('song');
  } catch (e) {
    console.error(e);
    toast(icon('x') + 'Não consegui ler esse .mid');
  }
}
// toca os próximos passos pra ouvir como é
let learnPlayT = [];
function learnListen() {
  learnPlayT.forEach(clearTimeout);
  learnPlayT = [];
  const st = LEARN.steps.slice(LEARN.i, LEARN.i + 12);
  if (!st.length) return;
  const msPerTick = LEARN.tab === 'song' && LEARN.song ? LEARN.song.tempo / 1000 / LEARN.song.ppq : 0;
  const t0 = st[0].tick ?? 0;
  st.forEach((x, k) => {
    const at = msPerTick ? (x.tick - t0) * msPerTick : k * 450;
    learnPlayT.push(setTimeout(() => {
      const hs = x.notes.map(n => Engine.noteOn(n, 90));
      setTimeout(() => hs.forEach(Engine.noteOff), 380);
    }, at));
  });
}
$('#btn-learn').addEventListener('click', () => { openModal('#learn-modal'); learnRender(); });
$('#learn-tabs').addEventListener('click', e => { const b = e.target.closest('button'); if (b) learnStart(b.dataset.t); });
$('#learn-open').addEventListener('click', learnOpen);
$('#learn-restart').addEventListener('click', () => learnStart());
$('#learn-skip').addEventListener('click', () => { if (LEARN.i < LEARN.steps.length) { LEARN.i++; learnRender(); learnShow(); } });
$('#learn-listen').addEventListener('click', learnListen);
$('#learn-oct').addEventListener('change', e => { LEARN.octave = e.target.checked; learnRender(); learnShow(); });
$('#learn-tracks').addEventListener('change', e => {
  const i = +e.target.dataset.i;
  if (e.target.checked) LEARN.sel.add(i); else LEARN.sel.delete(i);
  learnStart('song');
});
$('#learn-stop').addEventListener('click', () => { LEARN.on = false; learnShow(); closeModal('#learn-modal'); });
// a janela do aprender fica no topo sem cobrir o teclado da tela
const learnObs = new MutationObserver(() => { if ($('#learn-modal').classList.contains('hidden')) { LEARN.on = false; learnShow(); } });
learnObs.observe($('#learn-modal'), { attributes: true, attributeFilter: ['class'] });

// =====================================================================
// atalhos e início
// =====================================================================
window.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT' && e.target.type !== 'range' && e.target.type !== 'checkbox') return;
  if (e.ctrlKey && (e.code === 'KeyY' || (e.shiftKey && e.code === 'KeyZ'))) { e.preventDefault(); e.stopImmediatePropagation(); return redoEdit(); }
  if (e.target.tagName === 'SELECT' || e.ctrlKey || e.altKey || e.repeat) return;
  if (e.code === 'F11') { e.preventDefault(); toggleShow(); }
  if (e.code === 'Escape' && SHOW.on) toggleShow(false);
}, true);

studioStart();
renderLock();
renderRedo();
